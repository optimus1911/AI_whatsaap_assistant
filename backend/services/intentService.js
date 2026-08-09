import { parsePendingAssistantAction, resolveFollowUpState } from './pendingActionService.js';
import { resolveEntityComparison } from './entityComparisonService.js';
import { normalizeCustomerMessage, isPrimaryPolicyQuery, resolvePolicyIntent } from './queryNormalizationService.js';
import {
  buildConversationContext,
  resolveReferences,
  canExecuteProductSearch,
  findProductInCatalog,
  canonicalBrand
} from './conversationContextService.js';
import { buildProductSelectionResponse, buildBrandClarificationResponse } from './deterministicResponseService.js';

const CONFIRMATION_PATTERNS = /^(yes|yeah|yep|yup|sure|okay|ok|y|haan|ha|theek\s+hai|please\s+do|do\s+it|show\s+me|send\s+it|go\s+ahead|tell\s+me|show|definitely|absolutely|fine|why\s+not|that\s+sounds\s+good)[\.!\?]*$/i;
const DENIAL_PATTERNS = /^(no|nope|nah|not\s+now|nevermind|don't|cancel|nahi|na|nahi\s+ye\s+nahi\s+chahiye|ye\s+nahi\s+chahiye)[\.!\?]*$/i;

const BRAND_PATTERNS = /\b(HP|Lenovo|Dell|ASUS|Acer|Apple|MacBook)\b/i;
const RAM_PATTERNS = /\b(8\s*GB|16\s*GB|32\s*GB|64\s*GB)\b/i;
const STORAGE_PATTERNS = /\b(256\s*GB|512\s*GB|1\s*TB|2\s*TB)\b/i;
const PRICE_LIMIT_PATTERNS = /(?:under|below|less\s+than|within|budget\s+(?:of|is)?|for|around|up\s+to|go\s+up\s+to|max\s+(?:of|is)?)\s*(?:rs\.?|inr|₹)?\s*(\d{1,3}(?:,\d{3})+(?:k)?|\d+k|\d+)/i;

const USE_CASE_PATTERNS = /\b(coding|programming|developer|development|software|student|college|study|gaming|gamer|games|office|business|video\s+editing|editing|rendering|3d|ai|machine\s+learning|ml)\b/i;

// Comprehensive patterns for whole-conversation reset
const CONVERSATION_RESET_PATTERNS = /\b(forget\s+(?:every|all|the|our)?\s*(?:chat|chats|conversation|everything|context|what\s+we\s+discussed|what\s+we\s+did|previous\s+chats?)|\bstart\s+fresh\b|\bstart\s+over\b|\bnew\s+conversation\b|\blet'?s\s+start\s+again\b|\bclear\s+(?:previous\s+)?context\b|\bignore\s+everything\s*(?:before\s+this)?|\bclear\s+chat\b|\breset\s+chat\b|\breset\s+conversation\b)\b/i;

// Comprehensive patterns for explicit user resets or relaxations of individual constraints
const RESET_BRAND_PATTERNS = /\b(any\s+brand|forget\s+(?:the\s+)?brand|no\s+brand\s+preference|all\s+brands|any\s+brand\s+is\s+fine)\b/i;
const RESET_RAM_PATTERNS = /\b(forget\s+(?:the\s+)?ram|any\s+ram|no\s+ram\s+(?:limit|requirement)|don't\s+care\s+about\s+ram)\b/i;
const RESET_STORAGE_PATTERNS = /\b(forget\s+(?:the\s+)?storage|any\s+storage|no\s+storage\s+requirement|don't\s+care\s+about\s+storage)\b/i;
const RESET_USE_CASE_PATTERNS = /\b(forget\s+(?:the\s+)?(?:coding|use\s*case|gaming|study)|not\s+(?:for\s+)?(?:coding|gaming|college|business)|any\s+(?:use|purpose))\b/i;
const RESET_BUDGET_PATTERNS = /\b(forget\s+(?:the\s+)?(?:budget|price)|remove\s+(?:the\s+)?(?:[₹rs\.\d,k\s]+)?limit|any\s+(?:budget|price)|no\s+budget\s+limit)\b/i;

// Conversational questions/remarks about assistant's previous responses (MUST NOT trigger product search)
const CONVERSATIONAL_QUESTION_PATTERNS = [
  /\bwhy\s+(?:did\s+you|didn't\s+you|did\s+you\s+not|were\s+you\s+not|did\s+you\s+were\s+not|are\s+you|do\s+you|was\s+it|were\s+they|would\s+you|why\s+not)\b/i,
  /\bwhy\s+(?:did\s+you\s+were\s+not|did\s+you\s+not|didn't\s+you|did\s+you)\s+(?:clearify|clarify|show|recommend|give|choose|pick|suggest|compare)\b/i,
  /\b(what\s+(?:did\s+you\s+mean|do\s+you\s+mean|are\s+you\s+talking\s+about))\b/i,
  /\b(that\s+is\s+not\s+what\s+i\s+asked|that'?s\s+not\s+what\s+i\s+asked|i\s+didn'?t\s+ask\s+for\s+that|i\s+didn'?t\s+ask\s+for|i\s+did\s+not\s+ask\s+for)\b/i,
  /\b(you\s+misunderstood\s+me|you\s+got\s+it\s+wrong|that'?s\s+wrong|that\s+is\s+wrong|you\s+are\s+wrong)\b/i,
  /\bwhy\s+(?:dell|hp|lenovo|asus|acer|apple)\b/i,
  /\bwhy\s+(?:did\s+you\s+show|are\s+you\s+showing|did\s+you\s+choose|did\s+you\s+recommend)\s+(?:dell|hp|lenovo|asus|acer|apple)\b/i,
  /\bwhy\s+(?:didn't\s+you|did\s+you\s+not)\s+compare\s+(?:dell|hp|lenovo|asus|acer|apple)\b/i,
  /^what\s+about\s+(?:dell|hp|lenovo|asus|acer|apple)\??$/i,
  /\b(you\s+mentioned\s+(?:dell|hp|lenovo|asus|acer|apple)|i\s+was\s+talking\s+about\s+(?:dell|hp|lenovo|asus|acer|apple)|did\s+you\s+mean\s+(?:dell|hp|lenovo|asus|acer|apple))\b/i,
  /\b(i\s+didn'?t\s+ask\s+for\s+(?:dell|hp|lenovo|asus|acer|apple))\b/i,
  /\b(that'?s\s+not\s+what\s+i\s+asked\s+about\s+(?:dell|hp|lenovo|asus|acer|apple))\b/i,
];

function isConversationalQuestion(text = '') {
  if (!text || typeof text !== 'string') return false;
  return CONVERSATIONAL_QUESTION_PATTERNS.some((pattern) => pattern.test(text));
}

function isExplicitProductCorrection(text = '') {
  if (!text || typeof text !== 'string') return false;
  // e.g. "sorry i needed dell laptop", "sorry i meant dell laptops under 60000", "actually dell", "actually dell laptop"
  const hasCorrectionLead = /\b(sorry|actually|i\s+meant|i\s+mean|needed|instead)\b/i.test(text);
  const hasProductRequest = BRAND_PATTERNS.test(text);
  return hasCorrectionLead && hasProductRequest;
}

// Availability query patterns
const AVAILABILITY_PATTERNS = /\b(is\s+(?:this|it|that|the\s+laptop)\s+(?:available|in\s+stock)|available\s+hai(?:\s+kya)?|in\s+stock\??|is\s+this\s+available(?:\s+to\s+you)?|is\s+it\s+available(?:\s+to\s+you)?|do\s+you\s+have\s+this|is\s+(?:this|it)\s+ready\s+for\s+delivery)\b/i;
const SPECIFIC_MODEL_AVAILABILITY_PATTERN = /\b(?:is\s+(?:the\s+)?)?(Pavilion|Victus|ThinkPad|IdeaPad|Inspiron|Vostro|MacBook|ProBook|EliteBook|Legion|LOQ|Vivobook|Zenbook|TUF|ROG|Aspire|Swift|Nitro|15s)(?:\s+laptop)?\s+(?:available|in\s+stock|hai\s+kya)\b/i;

/**
 * Checks if the current message contains explicit product-search indicators.
 * A legitimate PRODUCT_SEARCH must have explicit search evidence in the CURRENT turn.
 * Brand mention ALONE is NOT sufficient evidence for PRODUCT_SEARCH.
 */
function hasCurrentTurnProductEvidence(text = '') {
  if (!text || typeof text !== 'string') return false;

  // Conversational questions / remarks about assistant responses are NOT search evidence
  if (isConversationalQuestion(text) && !isExplicitProductCorrection(text)) {
    return false;
  }

  const hasBrand = BRAND_PATTERNS.test(text);
  const hasPrice = PRICE_LIMIT_PATTERNS.test(text);
  const hasRam = RAM_PATTERNS.test(text);
  const hasStorage = STORAGE_PATTERNS.test(text);
  const hasUseCase = USE_CASE_PATTERNS.test(text);
  const hasLaptopKeyword = /\b(laptops?|notebooks?|macbooks?|pcs?|systems?|computers?)\b/i.test(text);
  const hasSearchVerbs = /\b(show\s+(?:me\s+)?|find|search|looking\s+for|i\s+want|i\s+need|suggest|recommend|give\s+me|options?|list|buy|purchase|needed|want\s+to\s+buy)\b/i.test(text);
  const hasModelName = /\b(Pavilion|Victus|ThinkPad|IdeaPad|Inspiron|Vostro|MacBook|ProBook|EliteBook|Legion|LOQ|Vivobook|Zenbook|TUF|ROG|Aspire|Swift|Nitro|15s)\b/i.test(text);
  const hasOverrideLead = /\b(actually|instead|needed|meant|only)\b/i.test(text);

  // 1. Explicit brand + (laptop keyword OR search verb OR price OR RAM OR storage OR useCase OR model OR override lead)
  if (hasBrand && (hasLaptopKeyword || hasSearchVerbs || hasPrice || hasRam || hasStorage || hasUseCase || hasModelName || hasOverrideLead)) {
    return true;
  }

  // 2. Explicit model name
  if (hasModelName) return true;

  // 3. Standalone price limit or RAM or Storage
  if (hasPrice || hasRam || hasStorage) return true;

  // 4. Use case + (laptop keyword OR search verb)
  if (hasUseCase && (hasLaptopKeyword || hasSearchVerbs)) return true;

  // 5. Laptop keyword + search verb (e.g. "show me laptops", "suggest laptops")
  if (hasLaptopKeyword && hasSearchVerbs) return true;

  // 6. Direct search command
  if (/^(show\s+me|find|search|give\s+me|look\s+for|i\s+want|i\s+need)\s+/i.test(text)) return true;

  return false;
}

/**
 * Analyzes the customer's input, recent conversation history, and pending assistant offers.
 * Implements strict ambiguity / confidence gating before ANY product search.
 *
 * @param {string} currentMessage
 * @param {string} conversationHistory
 * @param {string} [lastAssistantMessage=""]
 * @returns {object} Extracted intent, requirements, follow-up state, normalization info, and reference contexts
 */
export const detectIntentAndRequirements = (
  currentMessage = '',
  conversationHistory = '',
  lastAssistantMessage = ''
) => {
  // ===== STAGE 0: TEXT NORMALIZATION =====
  const normalization = normalizeCustomerMessage(currentMessage);
  const { normalizedText, corrections, policySignals, productSignals, confidence } = normalization;

  // Log normalization trace
  console.log(`[LANG-TRACE] originalMessage="${normalization.originalText}"`);
  console.log(`[LANG-TRACE] normalizedMessage="${normalizedText}"`);
  if (corrections.length > 0) {
    console.log(`[LANG-TRACE] corrections=${JSON.stringify(corrections)}`);
  }
  console.log(`[LANG-TRACE] normalizationConfidence=${confidence}`);
  console.log(`[LANG-TRACE] detectedPolicySignals=${JSON.stringify(policySignals)}`);
  console.log(`[LANG-TRACE] detectedProductSignals=${JSON.stringify(productSignals)}`);

  // Use normalized text for intent detection
  const text = normalizedText || (currentMessage || '').trim();
  const lowerText = text.toLowerCase();

  // Collect explicit signals from current message
  const explicitSignals = [];
  const brandMatch = text.match(BRAND_PATTERNS);
  if (brandMatch) explicitSignals.push(`brand:${brandMatch[1]}`);
  const priceMatch = text.match(PRICE_LIMIT_PATTERNS);
  if (priceMatch) explicitSignals.push(`price:${priceMatch[1]}`);
  const ramMatch = text.match(RAM_PATTERNS);
  if (ramMatch) explicitSignals.push(`ram:${ramMatch[1]}`);
  const useCaseMatch = text.match(USE_CASE_PATTERNS);
  if (useCaseMatch) explicitSignals.push(`useCase:${useCaseMatch[1]}`);

  // Initial State — DEFAULT INTENT IS 'UNKNOWN', NOT PRODUCT_SEARCH!
  const result = {
    intent: 'UNKNOWN',
    confidence: 1.0,
    searchAllowed: false,
    clarificationReason: null,
    explicitSignals,
    policySignals: policySignals || [],
    productSignals: productSignals || [],
    activeEntities: [],
    isConfirmation: false,
    isDenial: false,
    isHistoricalQuery: false,
    isComparison: false,
    isPolicyQuery: false,
    isAvailabilityQuery: false,
    isClarification: false,
    isDirectReply: false,
    directReply: null,
    clarificationMessage: null,
    policyCategory: null,
    pendingAction: { type: 'NONE', offeredActions: [], activeProducts: [] },
    followUpState: null,
    resolvedProducts: null,
    resolvedPronouns: null,
    responseSource: 'DETERMINISTIC_FALLBACK',
    normalization,
    requirements: {
      brand: null,
      ram: null,
      storage: null,
      maxPrice: null,
      minPrice: null,
      useCase: null,
      mentionedModels: []
    }
  };

  // ===== STAGE 0.5: CONVERSATION RESET =====
  if (CONVERSATION_RESET_PATTERNS.test(text)) {
    result.intent = 'CONVERSATION_RESET';
    result.searchAllowed = false;
    result.isDirectReply = true;
    result.directReply = "Sure — I've cleared the previous conversation context. What would you like help with?";
    result.responseSource = 'DETERMINISTIC_FALLBACK';
    result.activeEntities = [];
    result.pendingAction = { type: 'NONE', offeredActions: [], activeProducts: [] };
    result.requirements = { brand: null, ram: null, storage: null, maxPrice: null, minPrice: null, useCase: null, mentionedModels: [] };
    _logIntentGate(result, text, normalization, explicitSignals, [], result.pendingAction, {});
    return result;
  }

  // Filter history after latest reset if one occurred
  const effectiveHistory = _filterHistoryAfterLatestReset(conversationHistory);

  // 1. Parse Pending Action State & Active Context from Last Assistant Message
  const pendingAction = /cleared\s+the\s+previous\s+conversation/i.test(lastAssistantMessage)
    ? { type: 'NONE', offeredActions: [], activeProducts: [] }
    : parsePendingAssistantAction(lastAssistantMessage);
  const assistantContext = _extractAssistantProductContext(lastAssistantMessage, effectiveHistory);
  const activeEntities = pendingAction?.activeProducts?.length > 0
    ? pendingAction.activeProducts
    : (assistantContext.mentionedModels.length > 0 ? assistantContext.mentionedModels : []);

  result.pendingAction = pendingAction;
  result.activeEntities = activeEntities;

  // Extract historical requirements (used ONLY if current turn has legitimate search intent)
  const customerHistoryLines = effectiveHistory
    ? effectiveHistory
        .split('\n')
        .filter((line) => line.trim().startsWith('CUSTOMER:'))
        .map((line) => line.replace(/^CUSTOMER:\s*"?/i, '').replace(/"?$/, ''))
    : [];

  const historyText = customerHistoryLines.join(' ');
  const historicalRequirements = {
    brand: (historyText.match(BRAND_PATTERNS) || [])[1] || null,
    ram: (historyText.match(RAM_PATTERNS) || [])[1] || null,
    storage: (historyText.match(STORAGE_PATTERNS) || [])[1] || null,
    maxPrice: null,
    useCase: (historyText.match(USE_CASE_PATTERNS) || [])[1] || null
  };
  const historyPriceMatch = historyText.match(PRICE_LIMIT_PATTERNS);
  if (historyPriceMatch) {
    let rawNum = historyPriceMatch[1].toLowerCase().replace(/,/g, '');
    historicalRequirements.maxPrice = rawNum.endsWith('k') ? parseInt(rawNum.replace('k', ''), 10) * 1000 : parseInt(rawNum, 10);
  }

  // ===== STAGE 0.8: SECURITY & PROMPT INJECTION GUARD =====
  if (/\b(ignore\s+(?:all\s+)?(?:previous\s+)?instructions|system\s+prompt|pretend\s+price\s+is|show\s+hidden\s+catalog|reveal\s+(?:your\s+)?prompt)\b/i.test(text)) {
    result.intent = 'CLARIFICATION';
    result.isClarification = true;
    result.searchAllowed = false;
    result.clarificationReason = 'Security / Prompt Injection Guard';
    result.clarificationMessage = "I am SalesPilot's shopping assistant. How can I help you find the right laptop or answer any store policy questions?";
    result.responseSource = 'DETERMINISTIC_FALLBACK';
    _logIntentGate(result, text, normalization, explicitSignals, activeEntities, pendingAction, historicalRequirements);
    return result;
  }

  // ===== STAGE 1: PRIMARY POLICY SIGNAL PRIORITY CHECK =====
  // If the normalized message has policy signals and NO strong product signals,
  // route to policy BEFORE any product-search logic can inherit stale requirements.
  const isPrimaryPolicy = isPrimaryPolicyQuery(policySignals, productSignals);

  if (isPrimaryPolicy) {
    const resolved = resolvePolicyIntent(policySignals);
    if (resolved) {
      result.isPolicyQuery = true;
      result.policyCategory = resolved.category;
      result.intent = resolved.intent;
      result.searchAllowed = false;
      result.responseSource = 'BUSINESS_RAG';

      // For WARRANTY_QUERY, target specific model if available in context
      if (resolved.intent === 'WARRANTY_QUERY') {
        let specificActive = null;
        if (pendingAction?.activeProducts?.length > 0) {
          if (/\b(first\s+one|the\s+first)\b/i.test(lowerText)) {
            specificActive = pendingAction.activeProducts[0];
          } else if (/\b(second\s+one|the\s+second)\b/i.test(lowerText) && pendingAction.activeProducts.length >= 2) {
            specificActive = pendingAction.activeProducts[1];
          } else {
            const modelMatch = text.match(/\b(Pavilion|Victus|ThinkPad|IdeaPad|Inspiron|Vostro|MacBook|ProBook|EliteBook|Legion|LOQ|Vivobook|Zenbook|TUF|ROG|Aspire|Swift|Nitro|15s)\b/i);
            if (modelMatch) {
              specificActive = pendingAction.activeProducts.find((p) => new RegExp(modelMatch[1], 'i').test(p));
            }
          }
        }
        if (specificActive) {
          result.requirements.mentionedModels = [specificActive];
        } else if (pendingAction?.activeProducts?.length > 0) {
          result.requirements.mentionedModels = pendingAction.activeProducts;
        } else if (assistantContext.mentionedModels.length > 0) {
          result.requirements.mentionedModels = assistantContext.mentionedModels;
          if (assistantContext.brand) result.requirements.brand = assistantContext.brand;
          result.resolvedPronouns = assistantContext;
        }
      }

      _logIntentGate(result, text, normalization, explicitSignals, activeEntities, pendingAction, historicalRequirements);
      return result;
    }
  }

  // Parse rich conversation context across entire history
  const conversationContext = buildConversationContext(currentMessage, conversationHistory, lastAssistantMessage);

  // ===== STAGE 1.5: CONVERSATIONAL QUESTION & COMPLAINT GATE =====
  // Conversational remarks/questions about previous turns (e.g. "why did you were not clearify dell with dell", "why did you show Dell?", "why didn't you compare Dell?", "what about Dell?")
  // must NEVER trigger PRODUCT_SEARCH.
  if (isConversationalQuestion(text) && !isExplicitProductCorrection(text)) {
    result.intent = 'CLARIFICATION';
    result.isClarification = true;
    result.searchAllowed = false;
    result.clarificationReason = 'Customer asked conversational question or feedback regarding previous response';
    result.clarificationMessage = "I apologize for any confusion! I can help you find laptops matching your exact requirements or answer any policy questions — just let me know what brand or budget you prefer.";
    result.responseSource = 'DETERMINISTIC_FALLBACK';
    _logIntentGate(result, text, normalization, explicitSignals, activeEntities, pendingAction, historicalRequirements);
    return result;
  }

  // ===== STAGE 1.6: PRODUCT SELECTION & ORDINAL REFERENCE RESOLUTION =====
  // e.g. "i think 1st one", "first one", "the first one", "i think 1st one fits me well", "the second one", "the cheaper one", "the other one", "that one"
  const resolvedSelection = resolveReferences(text, conversationContext);
  if (resolvedSelection && resolvedSelection.targetProduct) {
    if (resolvedSelection.type === 'PRONOUN_BINDING') {
      if (/\b(ram|processor|storage|ssd|display|screen|gpu|graphics|os)\b/i.test(text)) {
        result.intent = 'ATTRIBUTE_QUERY';
        result.searchAllowed = false;
        result.requirements.mentionedModels = [resolvedSelection.modelName];
        result.responseSource = 'PRODUCT_RAG';
        _logIntentGate(result, text, normalization, explicitSignals, conversationContext.activeProducts, pendingAction, historicalRequirements);
        return result;
      }
      if (/\b(warranty)\b/i.test(text)) {
        result.intent = 'WARRANTY_QUERY';
        result.isPolicyQuery = true;
        result.policyCategory = 'warranty';
        result.searchAllowed = false;
        result.requirements.mentionedModels = [resolvedSelection.modelName];
        result.responseSource = 'BUSINESS_RAG';
        _logIntentGate(result, text, normalization, explicitSignals, conversationContext.activeProducts, pendingAction, historicalRequirements);
        return result;
      }
      if (/\b(available|in\s+stock|stock\s+hai)\b/i.test(text)) {
        result.intent = 'AVAILABILITY_QUERY';
        result.isAvailabilityQuery = true;
        result.searchAllowed = false;
        result.requirements.mentionedModels = [resolvedSelection.modelName];
        result.responseSource = 'PRODUCT_RAG';
        _logIntentGate(result, text, normalization, explicitSignals, conversationContext.activeProducts, pendingAction, historicalRequirements);
        return result;
      }
      if (/\b(price|cost|kitne\s+ka|how\s+much)\b/i.test(text)) {
        result.intent = 'PRICE_QUERY';
        result.searchAllowed = false;
        result.requirements.mentionedModels = [resolvedSelection.modelName];
        result.responseSource = 'PRODUCT_RAG';
        _logIntentGate(result, text, normalization, explicitSignals, conversationContext.activeProducts, pendingAction, historicalRequirements);
        return result;
      }
    } else {
      result.intent = 'PRODUCT_SELECTION';
      result.searchAllowed = false;
      result.isDirectReply = true;
      result.directReply = buildProductSelectionResponse(resolvedSelection.targetProduct);
      result.requirements.mentionedModels = [resolvedSelection.modelName];
      result.requirements.brand = resolvedSelection.targetProduct.brand;
      result.responseSource = 'PRODUCT_CONTEXT';
      result.resolvedProduct = resolvedSelection.targetProduct;
      _logIntentGate(result, text, normalization, explicitSignals, conversationContext.activeProducts, pendingAction, historicalRequirements);
      return result;
    }
  }

  if (resolvedSelection && resolvedSelection.type === 'AMBIGUOUS_OTHER') {
    const p0 = conversationContext.activeProducts[0];
    const name0 = p0 ? (typeof p0 === 'string' ? p0 : `${p0.brand} ${p0.model}`) : 'the shown model';
    result.intent = 'CLARIFICATION';
    result.isClarification = true;
    result.searchAllowed = false;
    result.clarificationReason = 'Requested alternate entity when only one entity is in context';
    result.clarificationMessage = `We currently have the *${name0}* in view. Would you like me to find another model or compare with another brand?`;
    result.responseSource = 'DETERMINISTIC_FALLBACK';
    _logIntentGate(result, text, normalization, explicitSignals, conversationContext.activeProducts, pendingAction, historicalRequirements);
    return result;
  }

  // Which one has [RAM/spec]? e.g. "which one has 16GB?", "which one has 8gb?", "which one has i5?"
  const whichOneSpecMatch = text.match(/which\s+(?:one\s+)?has\s+(16\s*gb|8\s*gb|32\s*gb|i5|i7|i3|ryzen\s*\d|512\s*gb|1\s*tb)/i);
  if (whichOneSpecMatch && conversationContext.activeProducts.length >= 1) {
    const specTarget = whichOneSpecMatch[1].toLowerCase().replace(/\s+/g, '');
    const matchedProduct = conversationContext.activeProducts.find(p => {
      const pStr = `${p.ram || ''} ${p.storage || ''} ${p.processor || ''}`.toLowerCase().replace(/\s+/g, '');
      return pStr.includes(specTarget);
    });
    if (matchedProduct) {
      result.intent = 'PRODUCT_SELECTION';
      result.searchAllowed = false;
      result.isDirectReply = true;
      result.directReply = `The *${matchedProduct.brand} ${matchedProduct.model}* comes with ${matchedProduct.ram} RAM and ${matchedProduct.storage}. Would you like more details on this model?`;
      result.requirements.mentionedModels = [`${matchedProduct.brand} ${matchedProduct.model}`];
      result.requirements.brand = matchedProduct.brand;
      result.responseSource = 'PRODUCT_CONTEXT';
      result.resolvedProduct = matchedProduct;
      _logIntentGate(result, text, normalization, explicitSignals, conversationContext.activeProducts, pendingAction, historicalRequirements);
      return result;
    }
  }

  // Ambiguous demonstrative references ("that one", "this one") with multiple active products
  if (/\b(this\s+one|that\s+one|this\s+laptop|that\s+laptop|that|this)\b/i.test(text) && conversationContext.activeProducts.length >= 2 && !resolvedSelection) {
    const p0 = conversationContext.activeProducts[0];
    const p1 = conversationContext.activeProducts[1];
    const name0 = typeof p0 === 'string' ? p0 : `${p0.brand} ${p0.model}`;
    const name1 = typeof p1 === 'string' ? p1 : `${p1.brand} ${p1.model}`;

    result.intent = 'CLARIFICATION';
    result.isClarification = true;
    result.searchAllowed = false;
    result.clarificationReason = 'Ambiguous demonstrative reference with multiple active products';
    result.clarificationMessage = `Do you mean the *${name0}* or the *${name1}*?`;
    result.responseSource = 'DETERMINISTIC_FALLBACK';
    _logIntentGate(result, text, normalization, explicitSignals, conversationContext.activeProducts, pendingAction, historicalRequirements);
    return result;
  }

  // ===== STAGE 1.7: STANDALONE BRAND INQUIRY GATE =====
  // e.g. "hp", "dell", "lenovo" in isolation without search verbs or specs
  const isStandaloneBrand = /^(hp|lenovo|dell|asus|acer|apple|macbook)[\.!\?]*$/i.test(text.trim());
  if (isStandaloneBrand) {
    const brandName = _canonicalBrand(text.trim().replace(/[\.!\?]*$/, ''));
    if (lastAssistantMessage && /(?:would\s+you\s+like\s+.*or\s+|which\s+brand|what\s+brand|prefer\s+a\s+specific\s+brand)/i.test(lastAssistantMessage)) {
      result.intent = 'PRODUCT_SELECTION';
      result.requirements.brand = brandName;
      result.searchAllowed = false;
      result.responseSource = 'PRODUCT_CONTEXT';
      _logIntentGate(result, text, normalization, explicitSignals, conversationContext.activeProducts, pendingAction, historicalRequirements);
      return result;
    }
    result.intent = 'CLARIFICATION';
    result.isClarification = true;
    result.searchAllowed = false;
    result.clarificationReason = 'Standalone brand name inquiry';
    result.clarificationMessage = buildBrandClarificationResponse(brandName, conversationContext.activeProducts);
    result.responseSource = 'DETERMINISTIC_FALLBACK';
    _logIntentGate(result, text, normalization, explicitSignals, conversationContext.activeProducts, pendingAction, historicalRequirements);
    return result;
  }

  // ===== STAGE 1.8: ENTITY / COMPARISON FORGET GATE =====
  if (/\b(?:actually\s+)?forget\s+(?:dell|hp|lenovo|asus|acer|apple|that|this|it)\b/i.test(text)) {
    result.intent = 'CLARIFICATION';
    result.isClarification = true;
    result.searchAllowed = false;
    result.clarificationReason = 'User requested to forget entity/comparison';
    result.clarificationMessage = 'No problem! What would you like to explore next?';
    result.responseSource = 'DETERMINISTIC_FALLBACK';
    _logIntentGate(result, text, normalization, explicitSignals, activeEntities, pendingAction, historicalRequirements);
    return result;
  }

  // ===== STAGE 2: EXPLICIT TWO-ENTITY / CROSS-BRAND COMPARISON =====
  const entityCompare = resolveEntityComparison(
    text,
    pendingAction?.activeProducts || [],
    conversationHistory,
    lastAssistantMessage
  );

  if (entityCompare) {
    result.intent = 'PRODUCT_COMPARISON';
    result.isComparison = true;
    result.searchAllowed = false;
    result.requirements.mentionedModels = entityCompare.comparedModelNames;
    result.resolvedProducts = entityCompare.comparedProducts;
    result.responseSource = 'ENTITY_COMPARISON';
    result.followUpState = {
      isFollowUp: true,
      selectedAction: 'ENTITY_COMPARISON',
      targetIntent: 'PRODUCT_COMPARISON',
      activeProducts: entityCompare.comparedModelNames,
      staleRequirementsIgnored: { brand: 'HP', ram: null }
    };
    _logIntentGate(result, text, normalization, explicitSignals, activeEntities, pendingAction, historicalRequirements);
    return result;
  }

  // ===== STAGE 2.5: DIRECT BRAND CORRECTION CHECK =====
  // ("not Dell, Lenovo", "not Dell but Lenovo", "not lenovo, show dell")
  const brandCorrectionMatch = text.match(/\bnot\s+(?:hp|lenovo|dell|asus|acer|apple|macbook)[,\s]+(?:but\s+|show\s+(?:me\s+)?|give\s+me\s+|i\s+need\s+|i\s+want\s+)?(hp|lenovo|dell|asus|acer|apple|macbook)\b/i);
  if (brandCorrectionMatch) {
    result.requirements.brand = _canonicalBrand(brandCorrectionMatch[1]);
  }

  // ===== STAGE 3: EXPLICIT NEW SEARCH OVERRIDE =====
  const isExplicitNewSearch =
    /^(show\s+me|find|search|give\s+me|look\s+for|i\s+want|i\s+need|laptops?\s+under|actually)\s+/i.test(text) &&
    (BRAND_PATTERNS.test(text) || PRICE_LIMIT_PATTERNS.test(text) || RAM_PATTERNS.test(text) || USE_CASE_PATTERNS.test(text));

  // ===== STAGE 4: PENDING ASSISTANT ACTION RESOLUTION =====
  if (!isExplicitNewSearch && pendingAction.type !== 'NONE') {
    const followUp = resolveFollowUpState(text, pendingAction, result.requirements);
    result.followUpState = followUp;

    if (followUp.isFollowUp) {
      if (followUp.directReply) {
        result.intent = 'PRODUCT_COMPARISON';
        result.isDirectReply = true;
        result.directReply = followUp.directReply;
        result.searchAllowed = false;
        result.responseSource = 'DIRECT_REPLY';
        _logIntentGate(result, text, normalization, explicitSignals, activeEntities, pendingAction, historicalRequirements);
        return result;
      }

      if (followUp.isAmbiguous) {
        result.intent = 'CLARIFICATION';
        result.isClarification = true;
        result.clarificationMessage = followUp.clarificationMessage;
        result.searchAllowed = false;
        result.responseSource = 'CLARIFICATION';
        _logIntentGate(result, text, normalization, explicitSignals, activeEntities, pendingAction, historicalRequirements);
        return result;
      }

      if (followUp.targetIntent === 'PRODUCT_COMPARISON') {
        result.intent = 'PRODUCT_COMPARISON';
        result.isComparison = true;
        result.requirements.mentionedModels = followUp.activeProducts;
        result.searchAllowed = false;
        result.responseSource = 'FOLLOW_UP';
        _logIntentGate(result, text, normalization, explicitSignals, activeEntities, pendingAction, historicalRequirements);
        return result;
      }

      if (followUp.targetIntent === 'WARRANTY_QUERY') {
        result.intent = 'WARRANTY_QUERY';
        result.isPolicyQuery = true;
        result.policyCategory = 'warranty';
        result.requirements.mentionedModels = followUp.activeProducts;
        result.searchAllowed = false;
        result.responseSource = 'BUSINESS_RAG';
        _logIntentGate(result, text, normalization, explicitSignals, activeEntities, pendingAction, historicalRequirements);
        return result;
      }

      if (followUp.targetIntent === 'PRODUCT_SEARCH' && followUp.activeProducts.length === 1) {
        result.intent = 'PRODUCT_SEARCH';
        result.searchAllowed = true;
        result.requirements.mentionedModels = followUp.activeProducts;
        if (assistantContext.brand) result.requirements.brand = assistantContext.brand;
        result.responseSource = 'FOLLOW_UP';
        _extractCustomerRequirements(result, text, conversationHistory);
        _logIntentGate(result, text, normalization, explicitSignals, activeEntities, pendingAction, historicalRequirements);
        return result;
      }

      if (followUp.targetIntent === 'CONFIRMATION' || followUp.selectedAction === 'SHOW_PRODUCTS') {
        result.intent = 'CONFIRMATION';
        result.isConfirmation = true;
        result.searchAllowed = true;
        result.responseSource = 'PRODUCT_RAG';
        if (assistantContext.brand) result.requirements.brand = assistantContext.brand;
        const ramInOffer = lastAssistantMessage.match(RAM_PATTERNS);
        if (ramInOffer) result.requirements.ram = ramInOffer[1].replace(/\s+/g, '').toUpperCase();
        _extractCustomerRequirements(result, text, conversationHistory);
        _logIntentGate(result, text, normalization, explicitSignals, activeEntities, pendingAction, historicalRequirements);
        return result;
      }
    }
  }

  // ===== STAGE 5: SPECIFIC INTENT PATTERN CHECKS =====
  // 5A. Greetings
  if (/^(hi|hello|hey|good\s+morning|good\s+evening|greetings|namaste)[\.!\s]*$/i.test(text)) {
    result.intent = 'GREETING';
    result.searchAllowed = false;
    result.responseSource = 'DETERMINISTIC_FALLBACK';
    _logIntentGate(result, text, normalization, explicitSignals, activeEntities, pendingAction, historicalRequirements);
    return result;
  }

  // 5B. Denial ("no", "nope")
  if (DENIAL_PATTERNS.test(text)) {
    result.isDenial = true;
    result.intent = 'DENIAL';
    result.searchAllowed = false;
    result.responseSource = 'DETERMINISTIC_FALLBACK';
    _logIntentGate(result, text, normalization, explicitSignals, activeEntities, pendingAction, historicalRequirements);
    return result;
  }

  // 5C. Confirmation ("yes", "sure", "show me", "send it", "go ahead")
  if (CONFIRMATION_PATTERNS.test(text) || /^(show\s+me|send\s+it|tell\s+me|go\s+ahead)$/i.test(text)) {
    result.isConfirmation = true;
    result.intent = 'CONFIRMATION';
    result.searchAllowed = Boolean(assistantContext.brand || assistantContext.mentionedModels.length > 0 || pendingAction.offeredActions.includes('SHOW_PRODUCTS'));
    result.responseSource = 'PRODUCT_RAG';

    if (assistantContext.brand) {
      result.requirements.brand = assistantContext.brand;
    }
    const ramInOffer = lastAssistantMessage.match(RAM_PATTERNS);
    if (ramInOffer) {
      result.requirements.ram = ramInOffer[1].replace(/\s+/g, '').toUpperCase();
    }
    if (assistantContext.mentionedModels.length > 0) {
      result.requirements.mentionedModels = assistantContext.mentionedModels;
    }

    _extractCustomerRequirements(result, text, conversationHistory);
    _logIntentGate(result, text, normalization, explicitSignals, activeEntities, pendingAction, historicalRequirements);
    return result;
  }

  // 5D. Historical / Conversation Memory queries
  if (
    /(?:which\s+laptop\s+did\s+i|what\s+did\s+i\s+(?:ask|say|want|mention)|what\s+ram\s+did\s+i|what\s+ram\s+did\s+i\s+want|what\s+brand\s+did\s+i|what\s+was\s+(?:it|i\s+going\s+to\s+use\s+it|my\s+budget)\s+for|what\s+was\s+my\s+budget|which\s+brand\s+did\s+i|what\s+brand\??$|which\s+one\s+did\s+i|did\s+i\s+say)/i.test(
      text
    )
  ) {
    result.isHistoricalQuery = true;
    result.intent = 'HISTORICAL_QUERY';
    result.searchAllowed = false;
    result.responseSource = 'MEMORY';
    _extractCustomerRequirements(result, text, conversationHistory);
    _logIntentGate(result, text, normalization, explicitSignals, activeEntities, pendingAction, historicalRequirements);
    return result;
  }

  // 5E. Price Inquiry on an existing item / pronoun reference
  if (/\b(its\s+price|what\s+is\s+the\s+price|price\??|how\s+much\s+is\s+it\??|its\s+cost|what\s+does\s+it\s+cost|price\s+of\s+(?:the\s+)?(?:first|second|other|this|that|it))\b/i.test(text)) {
    result.intent = 'PRICE_QUERY';
    result.searchAllowed = false;
    result.responseSource = 'PRODUCT_RAG';

    if (/\b(first\s+one|the\s+first)\b/i.test(text) && activeEntities.length >= 1) {
      result.requirements.mentionedModels = [activeEntities[0]];
    } else if (/\b(second\s+one|the\s+second|the\s+other\s+one|other\s+one)\b/i.test(text) && activeEntities.length >= 2) {
      result.requirements.mentionedModels = [activeEntities[1]];
    } else if (assistantContext.mentionedModels.length > 0) {
      result.requirements.mentionedModels = assistantContext.mentionedModels;
    }

    if (assistantContext.brand) {
      result.requirements.brand = assistantContext.brand;
    }
    result.resolvedPronouns = assistantContext;
    _logIntentGate(result, text, normalization, explicitSignals, activeEntities, pendingAction, historicalRequirements);
    return result;
  }

  // ===== STAGE 6: AVAILABILITY & STOCK INQUIRY AMBIGUITY GATE =====
  if (AVAILABILITY_PATTERNS.test(text) || SPECIFIC_MODEL_AVAILABILITY_PATTERN.test(text)) {
    const specificModelMatch = text.match(SPECIFIC_MODEL_AVAILABILITY_PATTERN);

    if (specificModelMatch) {
      // Case A: Specific model mentioned in message (e.g. "is the Vostro available?")
      const modelName = specificModelMatch[1];
      result.intent = 'AVAILABILITY_QUERY';
      result.isAvailabilityQuery = true;
      result.searchAllowed = false;
      result.requirements.mentionedModels = [modelName];
      result.responseSource = 'PRODUCT_RAG';
      _logIntentGate(result, text, normalization, explicitSignals, activeEntities, pendingAction, historicalRequirements);
      return result;
    }

    if (activeEntities.length === 1) {
      // Case B: Exactly 1 active product in context -> Unambiguous AVAILABILITY_QUERY
      result.intent = 'AVAILABILITY_QUERY';
      result.isAvailabilityQuery = true;
      result.searchAllowed = false;
      result.requirements.mentionedModels = [activeEntities[0]];
      if (assistantContext.brand) result.requirements.brand = assistantContext.brand;
      result.responseSource = 'PRODUCT_RAG';
      _logIntentGate(result, text, normalization, explicitSignals, activeEntities, pendingAction, historicalRequirements);
      return result;
    }

    if (activeEntities.length >= 2) {
      // Case C: Multiple active products exist -> "This" is ambiguous -> CLARIFICATION
      result.intent = 'CLARIFICATION';
      result.isClarification = true;
      result.searchAllowed = false;
      result.clarificationReason = `Ambiguous availability target between ${activeEntities.join(' and ')}`;
      result.clarificationMessage = `Sure — which one do you mean, the *${activeEntities[0]}* or *${activeEntities[1]}*?`;
      result.responseSource = 'DETERMINISTIC_FALLBACK';
      _logIntentGate(result, text, normalization, explicitSignals, activeEntities, pendingAction, historicalRequirements);
      return result;
    }

    // Case D: No active product entities exist -> Context-aware CLARIFICATION
    const isPolicyTopic = /\b(delivery|shipping|emi|payment|return|refund|warranty)\b/i.test(conversationHistory);
    result.intent = 'CLARIFICATION';
    result.isClarification = true;
    result.searchAllowed = false;
    result.clarificationReason = 'No active product entity target for availability question';
    result.clarificationMessage = isPolicyTopic
      ? "Could you clarify what you're asking about — our EMI options, delivery timelines, or a specific laptop model?"
      : "Could you clarify what you're looking for — a specific brand, price range, or laptop model?";
    result.responseSource = 'DETERMINISTIC_FALLBACK';
    _logIntentGate(result, text, normalization, explicitSignals, activeEntities, pendingAction, historicalRequirements);
    return result;
  }

  // ===== STAGE 7: CONTEXTUAL REFERENTIAL PRONOUNS =====
  if (/^(what\s+about\s+this\??|what\s+about\s+this\s+one\??|tell\s+me\s+more\s+about\s+this|what\s+about\s+it\??)$/i.test(text)) {
    if (activeEntities.length >= 2) {
      result.intent = 'CLARIFICATION';
      result.isClarification = true;
      result.searchAllowed = false;
      result.clarificationReason = 'Ambiguous pronoun reference between multiple active products';
      result.clarificationMessage = `Sure — would you like more details on the *${activeEntities[0]}* or the *${activeEntities[1]}*?`;
      result.responseSource = 'DETERMINISTIC_FALLBACK';
      _logIntentGate(result, text, normalization, explicitSignals, activeEntities, pendingAction, historicalRequirements);
      return result;
    }

    if (activeEntities.length === 1) {
      result.intent = 'PRODUCT_SEARCH';
      result.searchAllowed = true;
      result.requirements.mentionedModels = [activeEntities[0]];
      if (assistantContext.brand) result.requirements.brand = assistantContext.brand;
      result.responseSource = 'PRODUCT_RAG';
      _logIntentGate(result, text, normalization, explicitSignals, activeEntities, pendingAction, historicalRequirements);
      return result;
    }

    result.intent = 'CLARIFICATION';
    result.isClarification = true;
    result.searchAllowed = false;
    result.clarificationReason = 'No active entity for referential pronoun';
    result.clarificationMessage = "Could you clarify what you'd like more details on — our policies or a specific laptop model?";
    result.responseSource = 'DETERMINISTIC_FALLBACK';
    _logIntentGate(result, text, normalization, explicitSignals, activeEntities, pendingAction, historicalRequirements);
    return result;
  }

  // Pronoun references ("that one", "this one", "that laptop", "this laptop", "show me that one")
  if (/^(that\s+one|this\s+one|the\s+\w+\s+one|show\s+me\s+that(\s+one)?|show\s+that(\s+one)?|that\s+laptop|this\s+laptop)$/i.test(text)) {
    if (assistantContext.brand || assistantContext.mentionedModels.length > 0) {
      result.intent = 'PRODUCT_SEARCH';
      result.searchAllowed = true;
      if (assistantContext.brand) result.requirements.brand = assistantContext.brand;
      if (assistantContext.mentionedModels.length > 0) result.requirements.mentionedModels = assistantContext.mentionedModels;
      result.resolvedPronouns = assistantContext;
      result.responseSource = 'PRODUCT_RAG';
      _logIntentGate(result, text, normalization, explicitSignals, activeEntities, pendingAction, historicalRequirements);
      return result;
    }

    result.intent = 'CLARIFICATION';
    result.isClarification = true;
    result.searchAllowed = false;
    result.clarificationReason = 'Pronoun could not be resolved against recent assistant messages';
    result.clarificationMessage = "Could you specify which laptop model you're referring to?";
    result.responseSource = 'DETERMINISTIC_FALLBACK';
    _logIntentGate(result, text, normalization, explicitSignals, activeEntities, pendingAction, historicalRequirements);
    return result;
  }

  // ===== STAGE 8: GENERAL COMPARISON QUERY =====
  if (/\b(compare\s+(?:them|these|those|the\s+first\s+two)|compare|which\s+(?:is|one\s+is)\s+better|difference\s+between|which\s+should\s+i\s+buy)\b/i.test(lowerText)) {
    result.isComparison = true;
    result.intent = 'PRODUCT_COMPARISON';
    result.searchAllowed = false;
    result.responseSource = 'PRODUCT_COMPARISON';
    if (pendingAction?.activeProducts?.length >= 2) {
      result.requirements.mentionedModels = pendingAction.activeProducts;
    }
    _logIntentGate(result, text, normalization, explicitSignals, activeEntities, pendingAction, historicalRequirements);
    return result;
  }

  // ===== STAGE 9: SECONDARY BUSINESS POLICY QUERIES =====
  if (/\b(return|return\s+policy|can\s+i\s+return|how\s+to\s+return|returns)\b/i.test(lowerText)) {
    result.isPolicyQuery = true;
    result.policyCategory = 'returns';
    result.intent = 'RETURN_POLICY';
    result.searchAllowed = false;
    result.responseSource = 'BUSINESS_RAG';
    _logIntentGate(result, text, normalization, explicitSignals, activeEntities, pendingAction, historicalRequirements);
    return result;
  }

  if (/\b(refund|money\s+back|refund\s+policy|refund\s+timeline)\b/i.test(lowerText)) {
    result.isPolicyQuery = true;
    result.policyCategory = 'refunds';
    result.intent = 'REFUND_POLICY';
    result.searchAllowed = false;
    result.responseSource = 'BUSINESS_RAG';
    _logIntentGate(result, text, normalization, explicitSignals, activeEntities, pendingAction, historicalRequirements);
    return result;
  }

  if (/\b(exchange|replacement|swap|exchange\s+policy)\b/i.test(lowerText)) {
    result.isPolicyQuery = true;
    result.policyCategory = 'exchanges';
    result.intent = 'EXCHANGE_POLICY';
    result.searchAllowed = false;
    result.responseSource = 'BUSINESS_RAG';
    _logIntentGate(result, text, normalization, explicitSignals, activeEntities, pendingAction, historicalRequirements);
    return result;
  }

  if (/\b(warranty|guarantee|repair|service\s+center)\b/i.test(lowerText)) {
    result.isPolicyQuery = true;
    result.policyCategory = 'warranty';
    result.intent = 'WARRANTY_QUERY';
    result.searchAllowed = false;
    result.responseSource = 'BUSINESS_RAG';
    if (activeEntities.length > 0) {
      result.requirements.mentionedModels = activeEntities;
    }
    _logIntentGate(result, text, normalization, explicitSignals, activeEntities, pendingAction, historicalRequirements);
    return result;
  }

  if (/\b(shipping|delivery|dispatch|track|courier|how\s+long\s+to\s+deliver|pincode)\b/i.test(lowerText)) {
    result.isPolicyQuery = true;
    result.policyCategory = 'shipping';
    result.intent = 'SHIPPING_QUERY';
    result.searchAllowed = false;
    result.responseSource = 'BUSINESS_RAG';
    _logIntentGate(result, text, normalization, explicitSignals, activeEntities, pendingAction, historicalRequirements);
    return result;
  }

  if (/\b(emi|installments|no\s+cost\s+emi|down\s+payment|credit\s+card\s+emi)\b/i.test(lowerText)) {
    result.isPolicyQuery = true;
    result.policyCategory = 'payment';
    result.intent = 'PAYMENT_QUERY';
    result.searchAllowed = false;
    result.responseSource = 'BUSINESS_RAG';
    _logIntentGate(result, text, normalization, explicitSignals, activeEntities, pendingAction, historicalRequirements);
    return result;
  }

  if (/\b(payment|pay|cod|cash\s+on\s+delivery|upi|gpay|phonepe)\b/i.test(lowerText)) {
    result.isPolicyQuery = true;
    result.policyCategory = 'payment';
    result.intent = 'PAYMENT_QUERY';
    result.searchAllowed = false;
    result.responseSource = 'BUSINESS_RAG';
    _logIntentGate(result, text, normalization, explicitSignals, activeEntities, pendingAction, historicalRequirements);
    return result;
  }

  if (/\b(student\s+discount|college\s+discount|education\s+discount)\b/i.test(lowerText)) {
    result.isPolicyQuery = true;
    result.policyCategory = 'discounts';
    result.intent = 'DISCOUNT_QUERY';
    result.searchAllowed = false;
    result.responseSource = 'BUSINESS_RAG';
    _logIntentGate(result, text, normalization, explicitSignals, activeEntities, pendingAction, historicalRequirements);
    return result;
  }

  if (/\b(cancel|cancellation|cancel\s+order)\b/i.test(lowerText)) {
    result.isPolicyQuery = true;
    result.policyCategory = 'cancellation';
    result.intent = 'CANCELLATION_QUERY';
    result.searchAllowed = false;
    result.responseSource = 'BUSINESS_RAG';
    _logIntentGate(result, text, normalization, explicitSignals, activeEntities, pendingAction, historicalRequirements);
    return result;
  }

  if (/\b(damaged|broken|tampered|defect|faulty)\b/i.test(lowerText)) {
    result.isPolicyQuery = true;
    result.policyCategory = 'support';
    result.intent = 'SUPPORT_QUERY';
    result.searchAllowed = false;
    result.responseSource = 'BUSINESS_RAG';
    _logIntentGate(result, text, normalization, explicitSignals, activeEntities, pendingAction, historicalRequirements);
    return result;
  }

  // ===== STAGE 10: PRODUCT SEARCH EVIDENCE & AMBIGUITY GATE =====
  const hasSearchEvidence = hasCurrentTurnProductEvidence(text);

  if (hasSearchEvidence) {
    result.intent = 'PRODUCT_SEARCH';
    result.searchAllowed = true;
    result.responseSource = 'PRODUCT_RAG';
    _extractCustomerRequirements(result, text, conversationHistory);
    _logIntentGate(result, text, normalization, explicitSignals, activeEntities, pendingAction, historicalRequirements);
    return result;
  }

  // ===== STAGE 11: AMBIGUITY GATE — NEVER INVENT PRODUCT_SEARCH =====
  // No intent matched and no search evidence exists in current message.
  // Converting uncertainty to PRODUCT_SEARCH is strictly prohibited.
  result.intent = 'CLARIFICATION';
  result.isClarification = true;
  result.searchAllowed = false;
  result.clarificationReason = 'No explicit product-search evidence in current message';
  result.clarificationMessage = "Could you clarify what you're looking for — a specific brand, price range, or laptop model?";
  result.responseSource = 'DETERMINISTIC_FALLBACK';

  _logIntentGate(result, text, normalization, explicitSignals, activeEntities, pendingAction, historicalRequirements);
  return result;
};

/**
 * Filters out history lines that occurred prior to a conversation reset.
 */
function _filterHistoryAfterLatestReset(conversationHistory = '') {
  if (!conversationHistory) return '';
  const lines = conversationHistory.split('\n');
  let latestResetIdx = -1;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (CONVERSATION_RESET_PATTERNS.test(line) || /cleared\s+the\s+previous\s+conversation/i.test(line)) {
      latestResetIdx = i;
    }
  }

  if (latestResetIdx !== -1) {
    return lines.slice(latestResetIdx + 1).join('\n');
  }
  return conversationHistory;
}

function _canonicalBrand(brand) {
  if (!brand) return null;
  const lower = brand.toLowerCase();
  if (lower === 'hp') return 'HP';
  if (lower === 'lenovo') return 'Lenovo';
  if (lower === 'dell') return 'Dell';
  if (lower === 'asus') return 'ASUS';
  if (lower === 'acer') return 'Acer';
  if (lower === 'apple' || lower === 'macbook') return 'Apple';
  if (lower === 'samsung') return 'Samsung';
  if (lower === 'msi') return 'MSI';
  if (lower === 'razer') return 'Razer';
  return brand.charAt(0).toUpperCase() + brand.slice(1);
}

/**
 * Helper to extract customer requirements from current turn and conversation history.
 * ONLY called when current turn intent is legitimately verified as PRODUCT_SEARCH or HISTORICAL_QUERY.
 */
function _extractCustomerRequirements(result, text, conversationHistory) {
  const effectiveHistory = _filterHistoryAfterLatestReset(conversationHistory);

  const customerHistoryLines = effectiveHistory
    ? effectiveHistory
        .split('\n')
        .filter((line) => line.trim().startsWith('CUSTOMER:'))
        .map((line) => line.replace(/^CUSTOMER:\s*"?/i, '').replace(/"?$/, ''))
    : [];

  const combinedCustomerText = [...customerHistoryLines, text].join(' ');

  // Extract Brand: Current turn brand strictly overrides history!
  const brandCorrectionMatch = text.match(/\bnot\s+(?:hp|lenovo|dell|asus|acer|apple|macbook)[,\s]+(?:but\s+|show\s+(?:me\s+)?|give\s+me\s+|i\s+need\s+|i\s+want\s+)?(hp|lenovo|dell|asus|acer|apple|macbook)\b/i);
  const currentBrandMatch = text.match(BRAND_PATTERNS);
  let historyBrandMatch = null;
  for (let i = customerHistoryLines.length - 1; i >= 0; i--) {
    const m = customerHistoryLines[i].match(BRAND_PATTERNS);
    if (m) {
      historyBrandMatch = m;
      break;
    }
  }

  const pureNegationMatch = text.match(/\b(?:not|no|don't\s+show|dont\s+show)\s+(hp|lenovo|dell|asus|acer|apple|macbook)\b/i);
  if (RESET_BRAND_PATTERNS.test(text)) {
    result.requirements.brand = null;
  } else if (brandCorrectionMatch) {
    result.requirements.brand = _canonicalBrand(brandCorrectionMatch[1]);
  } else if (pureNegationMatch && !text.match(/(?:show|give\s+me|i\s+want|i\s+need)\s+(hp|lenovo|dell|asus|acer|apple|macbook)/i)) {
    result.requirements.excludedBrands = [_canonicalBrand(pureNegationMatch[1])];
    if (result.requirements.brand === _canonicalBrand(pureNegationMatch[1])) {
      result.requirements.brand = null;
    }
  } else if (currentBrandMatch) {
    result.requirements.brand = _canonicalBrand(currentBrandMatch[1]);
  } else if (historyBrandMatch) {
    result.requirements.brand = _canonicalBrand(historyBrandMatch[1]);
  }

  // Extract RAM
  const currentRamMatch = text.match(RAM_PATTERNS);
  let historyRamMatch = null;
  for (let i = customerHistoryLines.length - 1; i >= 0; i--) {
    const m = customerHistoryLines[i].match(RAM_PATTERNS);
    if (m) {
      historyRamMatch = m;
      break;
    }
  }

  if (RESET_RAM_PATTERNS.test(text)) {
    result.requirements.ram = null;
  } else if (currentRamMatch) {
    result.requirements.ram = currentRamMatch[1].replace(/\s+/g, '').toUpperCase();
  } else if (historyRamMatch) {
    result.requirements.ram = historyRamMatch[1].replace(/\s+/g, '').toUpperCase();
  }

  // Extract Storage
  const currentStorageMatch = text.match(STORAGE_PATTERNS);
  let historyStorageMatch = null;
  for (let i = customerHistoryLines.length - 1; i >= 0; i--) {
    const m = customerHistoryLines[i].match(STORAGE_PATTERNS);
    if (m) {
      historyStorageMatch = m;
      break;
    }
  }

  if (RESET_STORAGE_PATTERNS.test(text)) {
    result.requirements.storage = null;
  } else if (currentStorageMatch) {
    result.requirements.storage = currentStorageMatch[1].replace(/\s+/g, '').toUpperCase();
  } else if (historyStorageMatch) {
    result.requirements.storage = historyStorageMatch[1].replace(/\s+/g, '').toUpperCase();
  }

  // Extract Budget / Max Price
  const currentPriceMatch = text.match(PRICE_LIMIT_PATTERNS);
  let historyPriceMatch = null;
  for (let i = customerHistoryLines.length - 1; i >= 0; i--) {
    const m = customerHistoryLines[i].match(PRICE_LIMIT_PATTERNS);
    if (m) {
      historyPriceMatch = m;
      break;
    }
  }

  if (RESET_BUDGET_PATTERNS.test(text)) {
    result.requirements.maxPrice = null;
  } else if (currentPriceMatch) {
    let rawNum = currentPriceMatch[1].toLowerCase().replace(/,/g, '');
    result.requirements.maxPrice = rawNum.endsWith('k') ? parseInt(rawNum.replace('k', ''), 10) * 1000 : parseInt(rawNum, 10);
  } else if (historyPriceMatch) {
    let rawNum = historyPriceMatch[1].toLowerCase().replace(/,/g, '');
    result.requirements.maxPrice = rawNum.endsWith('k') ? parseInt(rawNum.replace('k', ''), 10) * 1000 : parseInt(rawNum, 10);
  }

  // Extract Use Case
  const currentUseCaseMatch = text.match(USE_CASE_PATTERNS);
  const historyUseCaseMatch = combinedCustomerText.match(USE_CASE_PATTERNS);

  if (RESET_USE_CASE_PATTERNS.test(text)) {
    result.requirements.useCase = null;
  } else if (currentUseCaseMatch) {
    const uc = currentUseCaseMatch[1].toLowerCase();
    if (['coding', 'programming', 'developer', 'development', 'software'].includes(uc)) {
      result.requirements.useCase = 'coding';
    } else if (['gaming', 'gamer', 'games'].includes(uc)) {
      result.requirements.useCase = 'gaming';
    } else if (['student', 'college', 'study'].includes(uc)) {
      result.requirements.useCase = 'student';
    } else if (['office', 'business'].includes(uc)) {
      result.requirements.useCase = 'business';
    } else {
      result.requirements.useCase = uc;
    }
  } else if (historyUseCaseMatch) {
    const uc = historyUseCaseMatch[1].toLowerCase();
    if (['coding', 'programming', 'developer', 'development', 'software'].includes(uc)) {
      result.requirements.useCase = 'coding';
    } else if (['gaming', 'gamer', 'games'].includes(uc)) {
      result.requirements.useCase = 'gaming';
    } else if (['student', 'college', 'study'].includes(uc)) {
      result.requirements.useCase = 'student';
    } else if (['office', 'business'].includes(uc)) {
      result.requirements.useCase = 'business';
    } else {
      result.requirements.useCase = uc;
    }
  }
}

/**
 * Structured debug trace logger for INTENT-GATE and LANG-TRACE.
 */
function _logIntentGate(result, text, normalization, explicitSignals, activeEntities, pendingAction, historicalRequirements) {
  console.log(`[LANG-TRACE] finalIntent=${result.intent}`);
  console.log(`[LANG-TRACE] blockedProductSearch=${!result.searchAllowed}`);
  console.log(`[LANG-TRACE] responseSource=${result.responseSource}`);

  const brandMatch = text.match(BRAND_PATTERNS);
  const explicitBrand = brandMatch ? brandMatch[1] : null;

  console.log(`[INTENT-GATE] originalMessage="${normalization?.originalText || text}"`);
  console.log(`[INTENT-GATE] normalizedMessage="${normalization?.normalizedText || text}"`);
  console.log(`[INTENT-GATE] detectedIntent="${result.intent}"`);
  console.log(`[INTENT-GATE] conversationReset=${result.intent === 'CONVERSATION_RESET'}`);
  console.log(`[INTENT-GATE] currentTurnProductEvidence=${Boolean(hasCurrentTurnProductEvidence(text))}`);
  console.log(`[INTENT-GATE] productSearchAllowed=${result.searchAllowed}`);
  console.log(`[INTENT-GATE] explicitBrand=${JSON.stringify(explicitBrand)}`);
  console.log(`[INTENT-GATE] normalizedBrand=${JSON.stringify(result.requirements?.brand || explicitBrand || null)}`);
  console.log(`[INTENT-GATE] activeProducts=${JSON.stringify(activeEntities || [])}`);
  console.log(`[INTENT-GATE] pendingAction=${JSON.stringify(pendingAction || { type: 'NONE' })}`);
  console.log(`[INTENT-GATE] conversationalQuestion=${Boolean(isConversationalQuestion(text))}`);
  console.log(`[INTENT-GATE] historicalRequirementsIgnored=${Boolean(!result.searchAllowed || result.intent === 'CONVERSATION_RESET' || isConversationalQuestion(text))}`);
  console.log(`[INTENT-GATE] selectedAction="${result.followUpState?.selectedAction || result.intent}"`);
  console.log(`[INTENT-GATE] responseSource="${result.responseSource}"`);
}

/**
 * Extracts product context (brand, model names) from assistant messages.
 * Used for pronoun resolution: when the customer says "that one", "this one", etc.,
 * we resolve the referent from the most recent assistant product mention.
 *
 * @param {string} lastAssistantMessage - The immediately preceding assistant message
 * @param {string} conversationHistory - Full conversation history
 * @returns {{ brand: string|null, mentionedModels: string[] }}
 */
function _extractAssistantProductContext(lastAssistantMessage = '', conversationHistory = '') {
  const effectiveHistory = _filterHistoryAfterLatestReset(conversationHistory);

  const BRAND_RE = /\b(HP|Lenovo|Dell|ASUS|Acer|Apple|MacBook)\b/i;
  const MODEL_RE = /\b((?:HP|Lenovo|Dell|ASUS|Acer|Apple)\s+(?:Pavilion|Victus|ThinkPad|IdeaPad|Inspiron|Vostro|ProBook|EliteBook|Legion|LOQ|Vivobook|Zenbook|TUF|ROG|Aspire|Swift|Nitro|MacBook|15s)(?:\s+\w+)*)/gi;

  const result = { brand: null, mentionedModels: [] };

  // Priority 1: last assistant message
  const sources = [];
  if (lastAssistantMessage && !/cleared\s+the\s+previous\s+conversation/i.test(lastAssistantMessage)) {
    sources.push(lastAssistantMessage);
  }

  // Priority 2: ASSISTANT: lines in conversation history (most recent first)
  if (effectiveHistory) {
    const assistantLines = effectiveHistory
      .split('\n')
      .filter((line) => line.trim().startsWith('ASSISTANT:'))
      .map((line) => line.replace(/^ASSISTANT:\s*"?/i, '').replace(/"?$/, ''))
      .reverse();
    sources.push(...assistantLines);
  }

  for (const source of sources) {
    // Extract brand
    if (!result.brand) {
      const brandMatch = source.match(BRAND_RE);
      if (brandMatch) {
        result.brand = brandMatch[1];
        if (result.brand.toLowerCase() === 'macbook') result.brand = 'Apple';
      }
    }

    // Extract full model names
    if (result.mentionedModels.length === 0) {
      const models = [...source.matchAll(MODEL_RE)].map((m) => m[1].trim());
      if (models.length > 0) {
        result.mentionedModels = [...new Set(models)];
      }
    }

    // If we found both, stop searching
    if (result.brand && result.mentionedModels.length > 0) break;
  }

  return result;
}
