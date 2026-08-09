import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.resolve(__dirname, '../.env') });
dotenv.config(); // fallback

import { GoogleGenAI } from '@google/genai';
import { executeRagRetrieval } from './ragService.js';
import {
  buildMemoryResponse,
  buildProductCatalogResponse,
  buildBusinessPolicyResponse,
  buildProductComparisonResponse,
  buildProductAvailabilityResponse
} from './deterministicResponseService.js';

// Circuit breaker for Gemini API quota protection
let geminiCooldownUntil = 0;
const GEMINI_COOLDOWN_MS = 60000; // 60s cooldown on 429/ResourceExhausted

// Dynamic model blacklist for models returning 404
const unavailableModels = new Set();

const getAiClient = () => {
  return new GoogleGenAI({
    apiKey: process.env.GEMINI_API_KEY,
  });
};

// Official models for Google GenAI SDK v2
const CANDIDATE_MODELS = [
  'gemini-2.5-flash',
  'gemini-2.0-flash',
  'gemini-1.5-flash'
];

/**
 * Robust helper to extract a JSON block between the first '{' and the last '}'.
 */
const extractJsonBlock = (rawText) => {
  if (!rawText || typeof rawText !== 'string') return '';
  const firstBrace = rawText.indexOf('{');
  const lastBrace = rawText.lastIndexOf('}');
  if (firstBrace !== -1 && lastBrace !== -1 && lastBrace > firstBrace) {
    return rawText.substring(firstBrace, lastBrace + 1);
  }
  return rawText.trim();
};

/**
 * Defensive sanitizer to ensure the message sent to WhatsApp is ONLY
 * a direct, natural sales response and never meta drafting advice or filler.
 *
 * @param {string} rawReply The raw reply string from the AI.
 * @returns {string} Cleaned, direct customer-facing text.
 */
export const sanitizeCustomerReply = (rawReply) => {
  if (!rawReply || typeof rawReply !== 'string') {
    return "Hi! How can I assist you with laptops or product specifications today?";
  }

  let cleaned = rawReply.trim();

  // Strip leading/trailing quotes if wrapped
  if (
    (cleaned.startsWith('"') && cleaned.endsWith('"')) ||
    (cleaned.startsWith("'") && cleaned.endsWith("'"))
  ) {
    cleaned = cleaned.slice(1, -1).trim();
  }

  // Detect meta-writing patterns like "Option 1: ... Option 2: ..."
  const metaPattern = /(?:here\s+(?:are|is)\s+(?:a\s+few\s+|some\s+)?(?:polite\s+|good\s+)?options?|option\s+1\s*[:\-]|\bhere'?s\s+how\s+you\s+can\s+respond\b|\byou\s+can\s+reply\s+with\b|\bdepending\s+on\s+what\b)/i;

  if (metaPattern.test(cleaned)) {
    console.warn('⚠️ Detected meta-response pattern in Gemini output. Sanitizing...');

    const option1Match = cleaned.match(/option\s+1\s*[:\-]?\s*["']?([^"\n\r]+(?:["']|\n|$))/i);
    if (option1Match && option1Match[1]) {
      cleaned = option1Match[1].replace(/["']/g, '').trim();
    } else {
      cleaned = cleaned
        .replace(/^(?:here\s+(?:are|is)[^\n:]*[:\.\-]?\s*)/i, '')
        .replace(/^option\s*\d+\s*[:\.\-]?\s*/gim, '')
        .trim();
    }
  }

  // Strip generic placeholders like [Customer Name] or [Company Name]
  cleaned = cleaned.replace(/\[Customer Name\]/gi, '').replace(/\[Company Name\]/gi, 'SalesPilot');

  return cleaned.trim();
};

/**
 * RAG-First Grounded Response Router.
 * Resolves answers deterministically from Conversation Memory, Catalog, and Knowledge bases,
 * using Gemini for conversational synthesis with automatic deterministic fallback on quota limits.
 *
 * @param {string} prompt The latest incoming customer message text.
 * @param {string} [customerContext=""] Profile context about the customer.
 * @param {string} [conversationHistory=""] Recent chat history between customer and sales assistant.
 * @param {string} [lastAssistantMessage=""] Immediately preceding assistant reply.
 * @returns {Promise<{
 *   reply: string,
 *   leadScore: number,
 *   leadStatus: string,
 *   intent: string,
 *   sentiment: string,
 *   priority: string,
 *   summary: string,
 *   purchaseProbability: number,
 *   recommendedProduct: string,
 *   responseSource: string,
 *   geminiUsed: boolean
 * }>}
 */
export const generateAiResponse = async (
  prompt,
  customerContext = '',
  conversationHistory = '',
  lastAssistantMessage = ''
) => {
  // 1. Execute RAG Retrieval (Intent, Catalog Products, Business Policies, Pending Actions)
  const ragData = await executeRagRetrieval(prompt, conversationHistory, lastAssistantMessage);
  const {
    intent,
    requirements,
    productContext,
    knowledgeContext,
    rawProducts,
    rawKnowledge,
    isClarification,
    clarificationMessage,
    isDirectReply,
    directReply
  } = ragData;

  // Derive default lead scoring based on intent and requirements
  let defaultScore = 50;
  if (intent === 'PRODUCT_COMPARISON' || intent === 'CONFIRMATION') defaultScore = 80;
  else if (requirements.brand || requirements.ram || requirements.maxPrice) defaultScore = 70;
  else if (intent === 'RETURN_POLICY' || intent === 'REFUND_POLICY' || intent === 'WARRANTY_QUERY') defaultScore = 50;

  const defaultResult = {
    reply: '',
    leadScore: defaultScore,
    leadStatus: defaultScore >= 80 ? 'Hot' : defaultScore >= 50 ? 'Warm' : 'Cold',
    intent: intent || 'Product Inquiry',
    sentiment: 'Neutral',
    priority: defaultScore >= 80 ? 'High' : 'Medium',
    summary: `Customer inquired about ${requirements.brand || 'laptops'}.`,
    purchaseProbability: defaultScore,
    recommendedProduct: rawProducts.length > 0 ? `${rawProducts[0].brand} ${rawProducts[0].model}` : '',
    responseSource: 'DETERMINISTIC_FALLBACK',
    geminiUsed: false
  };

  // 2. High-Precision Short-Circuit for Direct Entity Replies (e.g. "which is cheaper?", Conversation Reset, or Product Selection)
  if (isDirectReply && directReply) {
    defaultResult.reply = directReply;
    const sourceTag = intent === 'CONVERSATION_RESET'
      ? 'DETERMINISTIC_FALLBACK'
      : intent === 'PRODUCT_SELECTION'
      ? 'PRODUCT_CONTEXT'
      : 'PRODUCT_COMPARISON';
    defaultResult.responseSource = sourceTag;
    defaultResult.summary = intent === 'CONVERSATION_RESET'
      ? 'Cleared previous conversation context.'
      : intent === 'PRODUCT_SELECTION'
      ? 'Customer selected a specific product option from active context.'
      : 'Direct comparative evaluation from active product set.';

    console.log(`[RESP-TRACE] responseSource=${sourceTag} | directReply=true`);
    console.log(`[CONV-TRACE] responseSource=${sourceTag}`);
    console.log(`[PROD-TRACE] responseSource=${sourceTag}`);
    console.log(`[PROD-TRACE] finalResponse="${directReply}"`);
    return defaultResult;
  }

  // 3. High-Precision Short-Circuit for Ambiguous Clarifications
  if (isClarification && clarificationMessage) {
    defaultResult.reply = clarificationMessage;
    defaultResult.responseSource = 'DETERMINISTIC_FALLBACK';
    defaultResult.summary = 'Assistant requested clarification between multiple offered actions.';

    console.log(`[RESP-TRACE] responseSource=DETERMINISTIC_FALLBACK | clarificationPrompt=true`);
    console.log(`[CONV-TRACE] responseSource=DETERMINISTIC_FALLBACK`);
    console.log(`[PROD-TRACE] responseSource=DETERMINISTIC_FALLBACK`);
    console.log(`[PROD-TRACE] finalResponse="${clarificationMessage}"`);
    return defaultResult;
  }

  // 4. High-Precision Deterministic Short-Circuit for Historical Memory Queries
  if (intent === 'HISTORICAL_QUERY') {
    const memoryAnswer = buildMemoryResponse(requirements, prompt);
    defaultResult.reply = memoryAnswer;
    defaultResult.responseSource = 'MEMORY';
    defaultResult.summary = `Customer verified past conversation requirements.`;

    console.log(`[RESP-TRACE] responseSource=MEMORY`);
    console.log(`[CONV-TRACE] responseSource=MEMORY`);
    console.log(`[PROD-TRACE] responseSource=MEMORY`);
    console.log(`[PROD-TRACE] finalResponse="${memoryAnswer}"`);
    return defaultResult;
  }

  // 5. Check Gemini Circuit Breaker / Cooldown Status
  const now = Date.now();
  const isCircuitOpen = now < geminiCooldownUntil;

  if (isCircuitOpen) {
    const cooldownSecs = Math.ceil((geminiCooldownUntil - now) / 1000);
    console.log(`[AI]\nIntent: ${intent}\nGemini available: false\nReason: RESOURCE_EXHAUSTED (${cooldownSecs}s remaining)\nUsing deterministic grounded fallback`);

    return fallbackToDeterministicResponse(prompt, intent, requirements, rawProducts, rawKnowledge, defaultResult);
  }

  // 6. Attempt Grounded Gemini Synthesis
  try {
    const ai = getAiClient();

    const systemPrompt = `You are SalesPilot AI, a live sales assistant operating inside a WhatsApp CRM for a technology hardware business selling laptops (HP, Lenovo, Dell, ASUS, Acer, Apple).

GROUND TRUTH RULES:
1. CONVERSATION HISTORY is the source of truth for all customer statements, preferences, RAM/brand/use-case requests, and prior context.
2. RETRIEVED PRODUCT CATALOG is the source of truth for:
   - Product models, specifications, processors, RAM, storage, prices (in INR ₹), availability, and stock.
3. RETRIEVED BUSINESS KNOWLEDGE is the source of truth for:
   - Return policy (7 days for eligible items in original condition).
   - Refund policy (processed in 5-7 business days to original payment method).
   - Warranty policy (1-year official manufacturer warranty across brand service centers).
   - Shipping & delivery policy (standard delivery takes 3-7 business days across India).
   - Payment & EMI policy (Credit/Debit cards, UPI, COD up to ₹50,000, 3/6 month No-Cost EMI on major credit cards).
   - Student discount (5% educational discount with valid college ID).
4. If the customer asks what they previously asked or said:
   - Read the CONVERSATION HISTORY and answer directly with the exact facts mentioned earlier.
5. If the customer asks to compare laptops:
   - Compare the retrieved products clearly on Price, RAM, Processor, Storage, GPU, and recommend the best one for their use case.
6. If the customer asks for warranty details on the discussed products:
   - Provide the 1-year brand warranty details for those specific models.
7. Single direct message:
   - Return ONLY the exact message to be sent to the customer on WhatsApp.
   - NEVER output "Option 1 / Option 2 / Option 3", generic templates, or drafting advice.
   - Keep responses natural, concise, helpful, and formatted with clean bullet points or WhatsApp bold formatting (*Model Name*) where helpful.

OUTPUT FORMAT:
You MUST respond with ONLY a strict, valid JSON object:
{
  "reply": "Direct, conversational WhatsApp response to the customer",
  "leadScore": (Integer 0-100),
  "leadStatus": "Hot" | "Warm" | "Cold",
  "intent": "Short phrase describing customer intent",
  "sentiment": "Positive" | "Neutral" | "Negative",
  "priority": "High" | "Medium" | "Low",
  "summary": "One sentence summary of customer status and requirement",
  "purchaseProbability": (Integer 0-100),
  "recommendedProduct": "Specific product model name if identified, or empty string"
}`;

    const finalPrompt = `${systemPrompt}

${customerContext ? `=== CUSTOMER PROFILE ===\n${customerContext}\n` : ''}
=== CONVERSATION HISTORY (Previous Messages) ===
${conversationHistory || 'No previous messages recorded for this customer.'}

=== CURRENT CUSTOMER MESSAGE ===
CUSTOMER: "${prompt}"

=== DETECTED INTENT & REQUIREMENTS ===
Intent: ${intent}
Requirements: ${JSON.stringify(requirements)}

=== RETRIEVED PRODUCT CATALOG (Ground Truth for Specs, Prices & Stock) ===
${productContext}

=== RETRIEVED BUSINESS KNOWLEDGE (Ground Truth for Policies, Shipping & Payment) ===
${knowledgeContext}

Generate JSON response now:`;

    console.log('Querying Gemini with Grounded RAG Context...');

    let response = null;
    let lastError = null;

    const modelsToTry = CANDIDATE_MODELS.filter((m) => !unavailableModels.has(m));

    for (const model of modelsToTry) {
      try {
        response = await ai.models.generateContent({
          model,
          contents: finalPrompt,
          config: {
            responseMimeType: 'application/json'
          }
        });
        if (response && response.text) break;
      } catch (err) {
        lastError = err;
        const msg = err.message || '';

        // If 404 (Not Found), blacklist model permanently in memory
        if (msg.includes('404') || msg.includes('NOT_FOUND') || msg.includes('not found')) {
          console.warn(`[GeminiService] Model ${model} returned 404. Blacklisting from future requests.`);
          unavailableModels.add(model);
          continue;
        }

        // If 429 (Resource Exhausted), activate cooldown circuit breaker
        if (msg.includes('429') || msg.includes('RESOURCE_EXHAUSTED') || msg.includes('Quota exceeded')) {
          geminiCooldownUntil = Date.now() + GEMINI_COOLDOWN_MS;
          console.warn(`[CircuitBreaker] Gemini 429 quota reached. Initiated 60s cooldown.`);
          break; // Stop immediately to preserve quota
        }
      }
    }

    if (!response || !response.text) {
      throw lastError || new Error('No available Gemini model returned a valid response');
    }

    const rawText = response.text || '';
    const parsedResult = JSON.parse(extractJsonBlock(rawText));

    if (parsedResult && parsedResult.reply) {
      parsedResult.reply = sanitizeCustomerReply(parsedResult.reply);
    }

    if (parsedResult && !parsedResult.recommendedProduct && rawProducts.length > 0) {
      parsedResult.recommendedProduct = `${rawProducts[0].brand} ${rawProducts[0].model}`;
    }

    const sourceTag =
      rawProducts.length > 0
        ? 'GEMINI_WITH_PRODUCT_RAG'
        : rawKnowledge.length > 0
        ? 'GEMINI_WITH_BUSINESS_RAG'
        : 'GEMINI_RAG';

    console.log(`[RESP-TRACE] responseSource=${sourceTag}`);
    console.log(`[CONV-TRACE] responseSource=${sourceTag}`);
    console.log(`[PROD-TRACE] responseSource=${sourceTag}`);
    console.log(`[PROD-TRACE] finalResponse="${parsedResult.reply}"`);

    return {
      ...defaultResult,
      ...parsedResult,
      responseSource: sourceTag,
      geminiUsed: true
    };
  } catch (error) {
    console.warn('[GeminiService] Gemini unavailable or quota limited. Engaging Grounded Deterministic Router.');
    return fallbackToDeterministicResponse(prompt, intent, requirements, rawProducts, rawKnowledge, defaultResult);
  }
};

/**
 * Deterministic Fallback Router: Guaranteed accurate, grounded answers when LLM is unavailable.
 */
function fallbackToDeterministicResponse(prompt, intent, requirements, rawProducts, rawKnowledge, defaultResult) {
  let replyText = '';
  let source = 'DETERMINISTIC_FALLBACK';

  if (intent === 'HISTORICAL_QUERY') {
    replyText = buildMemoryResponse(requirements, prompt);
    source = 'MEMORY';
  } else if (intent === 'AVAILABILITY_QUERY') {
    replyText = buildProductAvailabilityResponse(rawProducts, requirements.mentionedModels);
    source = 'PRODUCT_RAG';
  } else if (intent === 'CLARIFICATION') {
    replyText = defaultResult.clarificationMessage || "Could you clarify what you're looking for — a specific brand, price range, or laptop model?";
    source = 'DETERMINISTIC_FALLBACK';
  } else if (intent === 'WARRANTY_QUERY') {
    replyText = buildBusinessPolicyResponse(rawKnowledge, intent, requirements.mentionedModels);
    source = 'BUSINESS_RAG';
  } else if (rawKnowledge && rawKnowledge.length > 0) {
    replyText = buildBusinessPolicyResponse(rawKnowledge, intent, requirements.mentionedModels);
    source = 'BUSINESS_RAG';
  } else if (intent === 'PRODUCT_COMPARISON' && rawProducts && rawProducts.length >= 2) {
    replyText = buildProductComparisonResponse(rawProducts, requirements);
    source = 'PRODUCT_COMPARISON';
  } else if (rawProducts && rawProducts.length > 0) {
    const isConfirmation = intent === 'CONFIRMATION';
    replyText = buildProductCatalogResponse(rawProducts, requirements, isConfirmation);
    source = 'DETERMINISTIC_FALLBACK';
  } else {
    replyText = buildProductCatalogResponse([], requirements, false);
    source = 'DETERMINISTIC_FALLBACK';
  }

  console.log(`[RESP-TRACE] responseSource=${source}`);
  console.log(`[CONV-TRACE] responseSource=${source}`);
  console.log(`[PROD-TRACE] responseSource=${source}`);
  console.log(`[PROD-TRACE] finalResponse="${replyText}"`);

  return {
    ...defaultResult,
    reply: sanitizeCustomerReply(replyText),
    responseSource: source,
    geminiUsed: false
  };
}
