import { detectIntentAndRequirements } from './intentService.js';
import { searchProducts, getProductsByIdsOrModels } from './productSearchService.js';
import { searchBusinessKnowledge } from './businessKnowledgeService.js';

/**
 * Executes hybrid RAG retrieval for incoming customer message.
 * Dissects conversation memory, detects customer intent, handles pending assistant follow-up actions,
 * retrieves relevant product catalog items and official business policies, and packages grounded context for Gemini.
 *
 * @param {string} currentMessage The customer's latest message text.
 * @param {string} [conversationHistory=""] Previous messages in the conversation.
 * @param {string} [lastAssistantMessage=""] The immediately previous response sent by the sales assistant.
 * @returns {Promise<{
 *   intent: string,
 *   requirements: object,
 *   productContext: string,
 *   knowledgeContext: string,
 *   rawProducts: Array<object>,
 *   rawKnowledge: Array<object>,
 *   isClarification: boolean,
 *   clarificationMessage: string|null,
 *   isDirectReply: boolean,
 *   directReply: string|null,
 *   pendingAction: object|null,
 *   followUpState: object|null
 * }>}
 */
export const executeRagRetrieval = async (
  currentMessage = '',
  conversationHistory = '',
  lastAssistantMessage = ''
) => {
  // 1. Detect Intent, Extract Accumulated Requirements, and Resolve Pending Actions
  const intentData = detectIntentAndRequirements(
    currentMessage,
    conversationHistory,
    lastAssistantMessage
  );

  const {
    intent,
    requirements,
    isPolicyQuery,
    policyCategory,
    isComparison,
    isHistoricalQuery,
    isConfirmation,
    isClarification,
    isDirectReply,
    directReply,
    clarificationMessage,
    pendingAction,
    followUpState
  } = intentData;

  console.log(`[FLOW-TRACE] incomingCustomerTurn="${currentMessage}"`);
  console.log(`[CONV-TRACE] currentMessage="${currentMessage}"`);
  console.log(`[CONV-TRACE] normalizedMessage="${intentData.normalization?.normalizedText || currentMessage}"`);
  console.log(`[CONV-TRACE] detectedIntent=${intent}`);
  console.log(`[CONV-TRACE] activeProducts=${JSON.stringify(pendingAction?.activeProducts || [])}`);
  console.log(`[CONV-TRACE] pendingAction=${JSON.stringify(pendingAction || { type: 'NONE' })}`);
  console.log(`[CONV-TRACE] resolvedPronouns=${JSON.stringify(intentData.resolvedPronouns || (requirements.mentionedModels?.length > 0 ? { models: requirements.mentionedModels, brand: requirements.brand } : {}))}`);
  console.log(`[CONV-TRACE] explicitEntities=${JSON.stringify(requirements.mentionedModels || (requirements.brand ? [requirements.brand] : []))}`);
  console.log(`[CONV-TRACE] selectedProducts=${JSON.stringify(intentData.resolvedProducts ? intentData.resolvedProducts.map(p => `${p.brand} ${p.model}`) : (requirements.mentionedModels || []))}`);
  console.log(`[CONV-TRACE] staleRequirementsIgnored=${JSON.stringify(followUpState?.staleRequirementsIgnored || intentData.staleRequirementsIgnored || {})}`);
  console.log(`[CONV-TRACE] responseSource=${intentData.responseSource || (isDirectReply ? 'DIRECT_REPLY' : isClarification ? 'CLARIFICATION' : isPolicyQuery ? 'BUSINESS_RAG' : isComparison ? 'PRODUCT_COMPARISON' : 'PRODUCT_RAG')}`);

  console.log(`[REQ-TRACE] extractedRequirements=${JSON.stringify(requirements)}`);
  console.log(`[PROD-TRACE] message="${currentMessage}"`);
  console.log(`[PROD-TRACE] intent=${intent}`);
  console.log(`[PROD-TRACE] requirements=${JSON.stringify(requirements)}`);

  // Direct entity response short-circuit (e.g. "which is cheaper?")
  if (isDirectReply && directReply) {
    return {
      intent,
      requirements,
      productContext: '',
      knowledgeContext: '',
      rawProducts: [],
      rawKnowledge: [],
      isClarification: false,
      clarificationMessage: null,
      isDirectReply: true,
      directReply,
      pendingAction,
      followUpState
    };
  }

  // If follow-up resolved to an ambiguous confirmation clarification, skip heavy RAG
  if (isClarification && clarificationMessage) {
    return {
      intent,
      requirements,
      productContext: '',
      knowledgeContext: '',
      rawProducts: [],
      rawKnowledge: [],
      isClarification: true,
      clarificationMessage,
      isDirectReply: false,
      directReply: null,
      pendingAction,
      followUpState
    };
  }

  let rawProducts = [];
  let rawKnowledge = [];

  // 2. Route Business Policy & Warranty Queries
  if (isPolicyQuery || policyCategory) {
    console.log(`[RAG-TRACE] queryCategory=${policyCategory} | calling business knowledge retrieval...`);
    console.log('[PROD-TRACE] calling business knowledge retrieval...');
    rawKnowledge = await searchBusinessKnowledge({
      category: policyCategory,
      query: currentMessage,
      limit: 3
    });
  }

  // 3. Search Safety Gate & Product Queries
  const nonProductSearchIntents = [
    'GREETING',
    'CAPABILITY',
    'THANKS',
    'GOODBYE',
    'CASUAL_CONVERSATION',
    'DENIAL',
    'HISTORICAL_QUERY',
    'CONVERSATION_RESET',
    'CLARIFICATION'
  ];

  if (!isHistoricalQuery && !nonProductSearchIntents.includes(intent) && !isPolicyQuery && !isClarification) {
    // If intent is PRODUCT_SEARCH but search is NOT allowed by ambiguity gate, convert to CLARIFICATION
    if (intent === 'PRODUCT_SEARCH' && !intentData.searchAllowed) {
      console.log('[SAFETY-GATE] Blocked unauthorized PRODUCT_SEARCH with insufficient evidence. Converting to CLARIFICATION.');
      return {
        intent: 'CLARIFICATION',
        requirements: { brand: null, ram: null, storage: null, maxPrice: null, minPrice: null, useCase: null, mentionedModels: [] },
        productContext: '',
        knowledgeContext: '',
        rawProducts: [],
        rawKnowledge: [],
        isClarification: true,
        clarificationMessage: intentData.clarificationMessage || "Could you clarify what you're looking for — a specific brand, price range, or laptop model?",
        isDirectReply: false,
        directReply: null,
        pendingAction,
        followUpState
      };
    }

    console.log('[PROD-TRACE] calling product retrieval...');

    if (intentData.resolvedProducts && intentData.resolvedProducts.length >= 2) {
      rawProducts = intentData.resolvedProducts;
    } else if (isComparison && requirements.mentionedModels && requirements.mentionedModels.length >= 2) {
      // Comparison between specific models
      rawProducts = await getProductsByIdsOrModels(requirements.mentionedModels);
    } else if (intent === 'AVAILABILITY_QUERY' || intent === 'PRICE_QUERY') {
      if (requirements.mentionedModels && requirements.mentionedModels.length > 0) {
        rawProducts = await getProductsByIdsOrModels(requirements.mentionedModels);
      }
      if (rawProducts.length === 0 && requirements.brand) {
        rawProducts = await searchProducts({
          brand: requirements.brand,
          limit: 1
        });
      }
    }

    // If standard product search / confirmation / specs query
    if (rawProducts.length === 0 && (intentData.searchAllowed || intent === 'CONFIRMATION')) {
      // Only use keyword if NO structured brand/ram/maxPrice/useCase was identified and it's a short keyword
      const hasStructuredFilters = Boolean(
        requirements.brand || requirements.ram || requirements.maxPrice || requirements.useCase
      );

      let keywordFilter = null;
      if (!hasStructuredFilters && currentMessage.trim().length >= 3) {
        const isSentence = /\s+/.test(currentMessage.trim()) && currentMessage.trim().split(/\s+/).length > 3;
        if (!isSentence) {
          keywordFilter = currentMessage.trim();
        }
      }

      rawProducts = await searchProducts({
        brand: requirements.brand,
        ram: requirements.ram,
        storage: requirements.storage,
        maxPrice: requirements.maxPrice,
        minPrice: requirements.minPrice,
        useCase: requirements.useCase,
        keyword: keywordFilter,
        inStockOnly: true,
        limit: 4
      });
    }
  }

  console.log(`[RAG-TRACE] productCount=${rawProducts.length} | knowledgeCount=${rawKnowledge.length}`);
  console.log(`PRODUCT RAG RESULTS: ${rawProducts.length} products retrieved`);
  console.log(`BUSINESS RAG RESULTS: ${rawKnowledge.length} knowledge items retrieved`);

  // 4. Format Product Context String
  let productContext = '';
  if (rawProducts.length > 0) {
    productContext = rawProducts
      .map((p, idx) => {
        return `[Product #${idx + 1}]
- Model: ${p.brand} ${p.model} (ID: ${p.id})
- Price: ₹${p.price.toLocaleString('en-IN')} ${p.currency}
- RAM: ${p.ram}
- Storage: ${p.storage}
- Processor: ${p.processor}
- GPU: ${p.gpu}
- Display: ${p.display}
- OS: ${p.os}
- Use Cases: ${p.useCases.join(', ')}
- Availability: ${p.availability} (${p.stock} units in stock)
- Description: ${p.description}`;
      })
      .join('\n\n');
  } else {
    productContext = 'No specific products retrieved from catalog for this query.';
  }

  // 5. Format Business Knowledge Context String
  let knowledgeContext = '';
  if (rawKnowledge.length > 0) {
    knowledgeContext = rawKnowledge
      .map((k, idx) => {
        return `[Business Policy #${idx + 1}: ${k.title}]
Category: ${k.category}
Policy Rules: ${k.content}`;
      })
      .join('\n\n');
  } else {
    knowledgeContext = 'No specific business policy needed for this query.';
  }

  return {
    intent,
    requirements,
    productContext,
    knowledgeContext,
    rawProducts,
    rawKnowledge,
    isClarification: false,
    clarificationMessage: null,
    isDirectReply: false,
    directReply: null,
    pendingAction,
    followUpState
  };
};
