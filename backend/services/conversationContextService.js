import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { normalizeCustomerMessage, isPrimaryPolicyQuery, resolvePolicyIntent } from './queryNormalizationService.js';
import { parsePendingAssistantAction } from './pendingActionService.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const fallbackProductsPath = path.resolve(__dirname, '../data/products.json');

let cachedCatalog = null;
export const getCatalog = () => {
  if (!cachedCatalog) {
    try {
      cachedCatalog = JSON.parse(fs.readFileSync(fallbackProductsPath, 'utf-8'));
    } catch {
      cachedCatalog = [];
    }
  }
  return cachedCatalog;
};

// Patterns for brand names, models, specs, and price limits
export const BRAND_PATTERNS = /\b(HP|Lenovo|Dell|ASUS|Acer|Apple|MacBook)\b/i;
export const RAM_PATTERNS = /\b(8\s*GB|16\s*GB|32\s*GB|64\s*GB)\b/i;
export const STORAGE_PATTERNS = /\b(256\s*GB|512\s*GB|1\s*TB|2\s*TB)\b/i;
export const PRICE_LIMIT_PATTERNS = /(?:under|below|less\s+than|within|budget\s+(?:of|is)?|for|around|up\s+to|go\s+up\s+to|max\s+(?:of|is)?)\s*(?:rs\.?|inr|₹)?\s*(\d{1,3}(?:,\d{3})+(?:k)?|\d+k|\d+)/i;
export const USE_CASE_PATTERNS = /\b(coding|programming|developer|development|software|student|college|study|gaming|gamer|games|office|business|video\s+editing|editing|rendering|3d|ai|machine\s+learning|ml)\b/i;

// Whole-conversation reset patterns
export const CONVERSATION_RESET_PATTERNS = /\b(forget\s+(?:every|all|the|our)?\s*(?:chat|chats|conversation|everything|context|what\s+we\s+discussed|what\s+we\s+did|previous\s+chats?)|\bstart\s+fresh\b|\bstart\s+over\b|\bnew\s+conversation\b|\blet'?s\s+start\s+again\b|\bclear\s+(?:previous\s+)?context\b|\bignore\s+everything\s*(?:before\s+this)?|\bclear\s+chat\b|\breset\s+chat\b|\breset\s+conversation\b)\b/i;

// Conversational questions / feedback (MUST NOT trigger product search)
export const CONVERSATIONAL_QUESTION_PATTERNS = [
  /\bwhy\s+(?:did\s+you|didn't\s+you|did\s+you\s+not|were\s+you\s+not|did\s+you\s+were\s+not|are\s+you|do\s+you|was\s+it|were\s+they|would\s+you|why\s+not)\b/i,
  /\bwhy\s+(?:did\s+you\s+were\s+not|did\s+you\s+not|didn't\s+you|did\s+you)\s+(?:clearify|clarify|show|recommend|give|choose|pick|suggest|compare)\b/i,
  /\b(what\s+(?:did\s+you\s+mean|do\s+you\s+mean|are\s+you\s+talking\s+about))\b/i,
  /\b(that\s+is\s+not\s+what\s+i\s+asked|that'?s\s+not\s+what\s+i\s+asked|i\s+didn'?t\s+ask\s+for\s+that|i\s+didn'?t\s+ask\s+for|i\s+did\s+not\s+ask\s+for)\b/i,
  /\b(you\s+misunderstood\s+me|you\s+got\s+it\s+wrong|that'?s\s+wrong|that\s+is\s+wrong|you\s+are\s+wrong|you'?re\s+not\s+understanding\s+me|you\s+keep\s+misunderstanding|you'?re\s+confusing\s+me)\b/i,
  /\bwhy\s+(?:dell|hp|lenovo|asus|acer|apple)\b/i,
  /\bwhy\s+(?:did\s+you\s+show|are\s+you\s+showing|did\s+you\s+choose|did\s+you\s+recommend)\s+(?:dell|hp|lenovo|asus|acer|apple)\b/i,
  /\bwhy\s+(?:didn't\s+you|did\s+you\s+not)\s+compare\s+(?:dell|hp|lenovo|asus|acer|apple)\b/i,
  /^what\s+about\s+(?:dell|hp|lenovo|asus|acer|apple)\??$/i,
  /\b(you\s+mentioned\s+(?:dell|hp|lenovo|asus|acer|apple)|i\s+was\s+talking\s+about\s+(?:dell|hp|lenovo|asus|acer|apple)|did\s+you\s+mean\s+(?:dell|hp|lenovo|asus|acer|apple))\b/i,
  /\b(i\s+didn'?t\s+ask\s+for\s+(?:dell|hp|lenovo|asus|acer|apple))\b/i,
  /\b(that'?s\s+not\s+what\s+i\s+asked\s+about\s+(?:dell|hp|lenovo|asus|acer|apple))\b/i,
  /\b(what\s+are\s+you\s+doing|why\s+are\s+you\s+giving\s+me\s+laptops|why\s+are\s+you\s+showing\s+me\s+this|why\s+are\s+you\s+doing\s+this)\b/i,
  /\b(listen\s+to\s+what\s+i'?m\s+saying|listen\s+to\s+me|listen\b|stop\s+showing\s+me\s+(?:dell|hp|lenovo|asus|acer|apple)|i\s+already\s+told\s+you|i\s+told\s+you\s+before|don'?t\s+keep\s+repeating\s+this|no\s+no\s+no)\b/i
];

const MODEL_PATTERNS = [
  { brand: 'HP', model: 'Pavilion 15', regex: /\b(?:HP\s+)?Pavilion(?:\s*15)?\b/i },
  { brand: 'HP', model: 'Victus 15', regex: /\b(?:HP\s+)?Victus(?:\s*15)?\b/i },
  { brand: 'HP', model: 'ProBook 440 G10', regex: /\b(?:HP\s+)?ProBook(?:\s*440(?:\s*G10)?)?\b/i },
  { brand: 'HP', model: '15s', regex: /\b(?:HP\s+)?15s\b/i },
  { brand: 'Lenovo', model: 'IdeaPad Slim 3', regex: /\b(?:Lenovo\s+)?IdeaPad(?:\s*Slim\s*3)?\b/i },
  { brand: 'Lenovo', model: 'ThinkPad E14', regex: /\b(?:Lenovo\s+)?ThinkPad(?:\s*E14)?\b/i },
  { brand: 'Lenovo', model: 'LOQ 15', regex: /\b(?:Lenovo\s+)?LOQ(?:\s*15)?\b/i },
  { brand: 'Dell', model: 'Inspiron 15 3530', regex: /\b(?:Dell\s+)?Inspiron\s*15(?:\s*3530)?\b/i },
  { brand: 'Dell', model: 'Inspiron 14 5430', regex: /\b(?:Dell\s+)?Inspiron\s*14(?:\s*5430)?\b/i },
  { brand: 'Dell', model: 'Vostro 3520', regex: /\b(?:Dell\s+)?Vostro(?:\s*3520)?\b/i },
  { brand: 'Dell', model: 'Latitude 3440', regex: /\b(?:Dell\s+)?Latitude(?:\s*3440)?\b/i },
  { brand: 'ASUS', model: 'Vivobook 15', regex: /\b(?:ASUS\s+)?Vivobook(?:\s*15)?\b/i },
  { brand: 'ASUS', model: 'TUF Gaming F15', regex: /\b(?:ASUS\s+)?TUF(?:\s*Gaming(?:\s*F15)?)?\b/i },
  { brand: 'Acer', model: 'Aspire 5', regex: /\b(?:Acer\s+)?Aspire(?:\s*5)?\b/i },
  { brand: 'Acer', model: 'Nitro V 15', regex: /\b(?:Acer\s+)?Nitro(?:\s*V(?:\s*15)?)?\b/i },
  { brand: 'Apple', model: 'MacBook Air M2', regex: /\b(?:Apple\s+)?MacBook(?:\s*Air(?:\s*M2)?)?\b/i },
];

/**
 * Standardizes brand casing to canonical title format.
 */
export const canonicalBrand = (brand) => {
  if (!brand) return null;
  const lower = brand.toLowerCase().trim();
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
};

/**
 * Finds full catalog object for a given model string or brand+model string.
 */
export const findProductInCatalog = (str = '') => {
  if (!str || typeof str !== 'string') return null;
  const catalog = getCatalog();
  const clean = str.trim().toLowerCase();

  // Exact brand + model match
  let match = catalog.find(p => `${p.brand} ${p.model}`.toLowerCase() === clean);
  if (match) return match;

  // Exact model match
  match = catalog.find(p => p.model.toLowerCase() === clean);
  if (match) return match;

  // Pattern match
  for (const pat of MODEL_PATTERNS) {
    if (pat.regex.test(str)) {
      const found = catalog.find(p => p.brand.toLowerCase() === pat.brand.toLowerCase() && p.model.toLowerCase().includes(pat.model.toLowerCase().split(' ')[0]));
      if (found) return found;
    }
  }

  // Substring match
  match = catalog.find(p => clean.includes(p.model.toLowerCase()) || p.model.toLowerCase().includes(clean));
  return match || null;
};

/**
 * Extracts ordered product list from an assistant message text.
 */
export const extractStructuredProductList = (assistantText = '') => {
  if (!assistantText || typeof assistantText !== 'string') return [];
  const catalog = getCatalog();
  const products = [];

  // Pattern 1: Numbered list ("1. *HP Pavilion 15* — *₹65,999*")
  const numberedLines = assistantText.split('\n');
  for (const line of numberedLines) {
    const numMatch = line.match(/^(\d+)\.\s*\*?([a-zA-Z0-9\s]+?)\*?\s*—/);
    if (numMatch) {
      const index = parseInt(numMatch[1], 10);
      const rawName = numMatch[2].trim();
      const productObj = findProductInCatalog(rawName);
      if (productObj) {
        if (!products.some(p => p.id === productObj.id)) {
          products.push({
            index,
            ...productObj
          });
        }
      }
    }
  }

  if (products.length > 0) return products;

  // Pattern 2: Side-by-side comparison ("between the *HP Pavilion 15* and *HP 15s*")
  const compareMatch = assistantText.match(/between\s+(?:the\s+)?\*?([a-zA-Z0-9\s]+?)\*?\s+and\s+(?:the\s+)?\*?([a-zA-Z0-9\s]+?)\*?(?:\:|\.|\n|$)/i);
  if (compareMatch) {
    const name1 = compareMatch[1].trim();
    const name2 = compareMatch[2].trim();
    const p1 = findProductInCatalog(name1);
    const p2 = findProductInCatalog(name2);
    if (p1 && p2) {
      return [
        { index: 1, ...p1 },
        { index: 2, ...p2 }
      ];
    }
  }

  // Pattern 3: Sequential scan across text for model patterns
  const foundModels = [];
  for (const pat of MODEL_PATTERNS) {
    const m = assistantText.match(pat.regex);
    if (m) {
      const idx = assistantText.indexOf(m[0]);
      const p = catalog.find(c => c.brand.toLowerCase() === pat.brand.toLowerCase() && c.model.toLowerCase().includes(pat.model.toLowerCase().split(' ')[0]));
      if (p && !foundModels.some(f => f.product.id === p.id)) {
        foundModels.push({ pos: idx, product: p });
      }
    }
  }

  foundModels.sort((a, b) => a.pos - b.pos);
  return foundModels.map((f, i) => ({ index: i + 1, ...f.product }));
};

/**
 * Filters conversation history to include only messages after the most recent reset.
 */
export const filterHistoryAfterReset = (conversationHistory = '') => {
  if (!conversationHistory) return '';
  const lines = conversationHistory.split('\n');
  let resetIndex = -1;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (
      /\b(forget\s+(?:every|all|the|our)?\s*(?:chat|chats|conversation|everything|context|what\s+we\s+discussed|what\s+we\s+did|previous\s+chats?)|\bstart\s+fresh\b|\bstart\s+over\b|\bnew\s+conversation\b|\blet'?s\s+start\s+again\b|\bclear\s+(?:previous\s+)?context\b|\bignore\s+everything\s*(?:before\s+this)?|\bdon'?t\s+remember\s+anything\b|\bclear\s+chat\b|\breset\s+chat\b|\breset\s+conversation\b|\bcleared\s+the\s+previous\s+conversation\b)\b/i.test(line)
    ) {
      resetIndex = i;
    }
  }

  if (resetIndex !== -1) {
    return lines.slice(resetIndex + 1).join('\n');
  }
  return conversationHistory;
};

/**
 * Authoritative Central Conversation Context Engine.
 * Creates the unified context object for all downstream services.
 */
export const buildConversationContext = (
  rawMessage = '',
  conversationHistory = '',
  lastAssistantMessage = ''
) => {
  // 1. Text Normalization
  const normalization = normalizeCustomerMessage(rawMessage);
  const normalizedText = normalization.normalizedText || (rawMessage || '').trim();

  // 2. History isolation after latest reset
  const effectiveHistory = filterHistoryAfterReset(conversationHistory);

  // 3. Extract assistant messages & customer messages
  const assistantMessages = [];
  const customerMessages = [];

  if (effectiveHistory) {
    const turns = effectiveHistory.split(/(?=(?:^|\n)(?:CUSTOMER|ASSISTANT):)/i);
    for (const turn of turns) {
      const trimmed = turn.trim();
      if (/^ASSISTANT:/i.test(trimmed)) {
        assistantMessages.push(trimmed.replace(/^ASSISTANT:\s*"?/i, '').replace(/"?$/, '').trim());
      } else if (/^CUSTOMER:/i.test(trimmed)) {
        customerMessages.push(trimmed.replace(/^CUSTOMER:\s*"?/i, '').replace(/"?$/, '').trim());
      }
    }
  }

  if (lastAssistantMessage && !/cleared\s+the\s+previous\s+conversation/i.test(lastAssistantMessage)) {
    if (assistantMessages.length === 0 || assistantMessages[assistantMessages.length - 1] !== lastAssistantMessage) {
      assistantMessages.push(lastAssistantMessage);
    }
  }

  // 4. Scan backwards for recent product list & active comparison
  let lastProductList = [];
  let activeComparison = null;
  let activeProducts = [];

  for (let i = assistantMessages.length - 1; i >= 0; i--) {
    const msg = assistantMessages[i];
    const extracted = extractStructuredProductList(msg);
    if (extracted.length > 0) {
      lastProductList = extracted;
      activeProducts = extracted.map(p => `${p.brand} ${p.model}`);
      if (extracted.length >= 2) {
        activeComparison = {
          sourceProduct: extracted[0],
          targetProduct: extracted[1],
          candidates: extracted,
          order: [extracted[0].model, extracted[1].model]
        };
      }
      break;
    }
  }

  // 5. Parse pending question & action
  const latestAssistantMsg = assistantMessages[assistantMessages.length - 1] || lastAssistantMessage || '';
  const pendingAction = /cleared\s+the\s+previous\s+conversation/i.test(latestAssistantMsg)
    ? { type: 'NONE', offeredActions: [], activeProducts: [] }
    : parsePendingAssistantAction(latestAssistantMsg);

  let pendingQuestion = null;
  if (latestAssistantMsg) {
    const lowerLatest = latestAssistantMsg.toLowerCase();
    if (/\b(would\s+you\s+like\s+me\s+to\s+compare\b|compare\s+the\s+[\*a-zA-Z0-9\s]+and\s+[\*a-zA-Z0-9\s]+\?)/i.test(lowerLatest)) {
      pendingQuestion = { type: 'COMPARE_OFFER', options: ['COMPARE_PRODUCTS'], relatedEntities: activeProducts };
    } else if (/\b(check\s+warranty\s+details|warranty\s+for\s+the\s+[\*a-zA-Z0-9\s]+\?)/i.test(lowerLatest)) {
      pendingQuestion = { type: 'WARRANTY_OFFER', options: ['CHECK_WARRANTY'], relatedEntities: activeProducts };
    } else if (/\b(which\s+brand\s+would\s+you\s+prefer|prefer\s+a\s+specific\s+brand)/i.test(lowerLatest)) {
      pendingQuestion = { type: 'BRAND_PREFERENCE', options: ['HP', 'Lenovo', 'Dell', 'ASUS', 'Acer', 'Apple'], relatedEntities: [] };
    } else if (/\b(which\s+of\s+these\s+two\s+fits\s+your\s+requirements|which\s+one\s+do\s+you\s+prefer)/i.test(lowerLatest)) {
      pendingQuestion = { type: 'PRODUCT_SELECTION', options: ['1', '2'], relatedEntities: activeProducts };
    }
  }

  // 6. Extract historical requirements
  const historyCustomerText = customerMessages.join(' ');
  const historicalRequirements = {
    brand: canonicalBrand((historyCustomerText.match(BRAND_PATTERNS) || [])[1] || null),
    ram: (historyCustomerText.match(RAM_PATTERNS) || [])[1] || null,
    storage: (historyCustomerText.match(STORAGE_PATTERNS) || [])[1] || null,
    maxPrice: null,
    useCase: (historyCustomerText.match(USE_CASE_PATTERNS) || [])[1] || null
  };
  const histPriceMatch = historyCustomerText.match(PRICE_LIMIT_PATTERNS);
  if (histPriceMatch) {
    let rawNum = histPriceMatch[1].toLowerCase().replace(/,/g, '');
    historicalRequirements.maxPrice = rawNum.endsWith('k') ? parseInt(rawNum.replace('k', ''), 10) * 1000 : parseInt(rawNum, 10);
  }

  // 7. Extract current turn requirements
  const currentBrandMatch = normalizedText.match(BRAND_PATTERNS);
  const currentRamMatch = normalizedText.match(RAM_PATTERNS);
  const currentStorageMatch = normalizedText.match(STORAGE_PATTERNS);
  const currentPriceMatch = normalizedText.match(PRICE_LIMIT_PATTERNS);
  const currentUseCaseMatch = normalizedText.match(USE_CASE_PATTERNS);

  let currentMaxPrice = null;
  if (currentPriceMatch) {
    let rawNum = currentPriceMatch[1].toLowerCase().replace(/,/g, '');
    currentMaxPrice = rawNum.endsWith('k') ? parseInt(rawNum.replace('k', ''), 10) * 1000 : parseInt(rawNum, 10);
  }

  const currentTurnRequirements = {
    brand: currentBrandMatch ? canonicalBrand(currentBrandMatch[1]) : null,
    ram: currentRamMatch ? currentRamMatch[1] : null,
    storage: currentStorageMatch ? currentStorageMatch[1] : null,
    maxPrice: currentMaxPrice,
    useCase: currentUseCaseMatch ? currentUseCaseMatch[1] : null
  };

  const excludedBrands = [];
  const negationMatches = normalizedText.matchAll(/\b(?:not|no|don't\s+show|dont\s+show|exclude|without)\s+(HP|Lenovo|Dell|ASUS|Acer|Apple|MacBook)\b/gi);
  for (const m of negationMatches) {
    const b = canonicalBrand(m[1]);
    if (b && !excludedBrands.includes(b)) {
      excludedBrands.push(b);
    }
  }

  const explicitEntities = [];
  if (currentTurnRequirements.brand) explicitEntities.push(`brand:${currentTurnRequirements.brand}`);
  if (currentTurnRequirements.ram) explicitEntities.push(`ram:${currentTurnRequirements.ram}`);
  if (currentTurnRequirements.maxPrice) explicitEntities.push(`price:${currentTurnRequirements.maxPrice}`);

  // Classify Conversation Act
  let conversationAct = 'NEW_REQUEST';
  if (/\b(ignore\s+(?:all\s+)?(?:previous\s+)?instructions|system\s+prompt|pretend\s+price\s+is|show\s+hidden\s+catalog|reveal\s+(?:your\s+)?prompt)\b/i.test(normalizedText)) {
    conversationAct = 'SECURITY_PROMPT_INJECTION';
  } else if (CONVERSATION_RESET_PATTERNS.test(normalizedText)) {
    conversationAct = 'CONVERSATION_RESET';
  } else if (isPrimaryPolicyQuery(normalizedText)) {
    conversationAct = 'POLICY_REQUEST';
  } else if (CONVERSATIONAL_QUESTION_PATTERNS.some(p => p.test(normalizedText))) {
    conversationAct = 'FEEDBACK';
  } else if (/\b(not\s+(?:hp|lenovo|dell|asus|acer|apple|macbook)|actually|instead|i\s+meant|sorry\s+i\s+needed|no\s+i\s+want)\b/i.test(normalizedText)) {
    conversationAct = 'CORRECTION';
  } else if (/^(yes|yeah|yep|yup|sure|okay|ok|haan|ha|theek\s+hai)[\.!\?]*$/i.test(normalizedText)) {
    conversationAct = 'CONFIRMATION';
  } else if (/^(no|nope|nah|nahi|nahi\s+ye\s+nahi\s+chahiye|not\s+this)[\.!\?]*$/i.test(normalizedText)) {
    conversationAct = 'REJECTION';
  } else if (/\b(1st\s+one|first\s+one|second\s+one|2nd\s+one|the\s+cheaper\s+one|the\s+other\s+one|pehla\s+wala|dusra\s+wala|sasta\s+wala)\b/i.test(normalizedText)) {
    conversationAct = 'SELECTION';
  } else if (/\b(compare|which\s+is\s+better|which\s+one\s+is\s+better|which\s+one\s+is\s+cheaper|which\s+should\s+i\s+buy)\b/i.test(normalizedText)) {
    conversationAct = 'COMPARISON';
  } else if (/\b(how\s+much|price|cost|warranty|available|in\s+stock|kitne\s+ka|kab\s+milega|ram|processor|storage)\b/i.test(normalizedText)) {
    conversationAct = 'QUESTION';
  } else if (/^(hp|dell|lenovo|asus|acer|apple|macbook)[\.!\?]*$/i.test(normalizedText.trim()) || /^what\s+about\s+(?:hp|dell|lenovo|asus|acer|apple)\??$/i.test(normalizedText.trim())) {
    conversationAct = 'AMBIGUOUS_REQUEST';
  } else if (/^(thanks|thank\s+you|shukriya|dhanyawad)[\.!\?]*$/i.test(normalizedText)) {
    conversationAct = 'ACKNOWLEDGEMENT';
  } else if (/^(hi|hello|hey|good\s+morning|good\s+evening|namaste)[\.!\?]*$/i.test(normalizedText)) {
    conversationAct = 'GREETING';
  }

  if (conversationAct === 'CONVERSATION_RESET') {
    activeProducts = [];
    lastProductList = [];
    activeComparison = null;
    pendingQuestion = null;
    historicalRequirements.brand = null;
    historicalRequirements.ram = null;
    historicalRequirements.storage = null;
    historicalRequirements.maxPrice = null;
    historicalRequirements.useCase = null;
    currentTurnRequirements.brand = null;
    currentTurnRequirements.ram = null;
    currentTurnRequirements.storage = null;
    currentTurnRequirements.maxPrice = null;
    currentTurnRequirements.useCase = null;
    excludedBrands.length = 0;
  }

  // Unified structured context object
  return {
    conversationId: null,
    resetVersion: 1,
    currentTurn: {
      rawText: rawMessage,
      normalizedText,
      corrections: normalization.corrections || [],
      language: normalization.language || 'en',
      confidence: normalization.confidence || 1.0
    },
    conversationAct,
    activeTopic: {
      type: conversationAct === 'POLICY_REQUEST' ? 'POLICY' : conversationAct === 'COMPARISON' ? 'COMPARISON' : 'GENERAL',
      confidence: 1.0
    },
    activeEntities: activeProducts,
    activeProducts: lastProductList,
    activeComparison,
    lastProductList,
    lastSelectedProduct: null,
    lastAssistantProducts: activeProducts,
    lastCustomerProducts: [],
    lastAssistantQuestion: pendingQuestion ? pendingQuestion.type : null,
    pendingAction,
    pendingQuestion,
    historicalRequirements,
    currentTurnRequirements,
    excludedBrands,
    resolvedReferences: [],
    explicitEntities,
    conversationalState: {},
    intent: null,
    intentConfidence: 1.0,
    searchAllowed: false,
    clarificationRequired: false,
    staleRequirementsIgnored: {},
    responseSource: 'DETERMINISTIC_FALLBACK'
  };
};

/**
 * Universal Reference Resolver.
 * Resolves pronouns, ordinals, comparatives, alternates, and targets against active context.
 */
export const resolveReferences = (text = '', context = {}) => {
  if (!text || typeof text !== 'string') return null;
  const lower = text.toLowerCase().trim();
  const { activeProducts = [], lastProductList = [] } = context;

  const list = activeProducts.length > 0 ? activeProducts : lastProductList;
  if (list.length === 0) return null;

  // 1. Ordinals (1st, first, option 1, the first one, show the first one, pehla wala, etc.)
  const isFirstOrdinal =
    /\b(?:show\s+(?:me\s+)?)?(?:1st\s+(?:one|laptop|option|model)|first\s+(?:one|laptop|option|model)|the\s+first|the\s+1st|number\s+1|option\s+1|the\s+former|pehla\s+wala|pehle\s+wala)\b/i.test(lower) ||
    /^(1st|first|1|opt\s*1|pehla)$/i.test(lower) ||
    /\b(?:i\s+think\s+)?(?:1st|first)\s+(?:one\s+)?(?:fits\s+me|is\s+better|looks\s+good|works)\b/i.test(lower) ||
    /\b(?:i\s+prefer|i'll\s+take|i\s+want|take|choose|like)\s+(?:the\s+)?(?:1st|first)(?:\s+one)?\b/i.test(lower);

  if (isFirstOrdinal && list.length >= 1) {
    return {
      type: 'ORDINAL',
      index: 1,
      targetProduct: list[0],
      modelName: `${list[0].brand} ${list[0].model}`,
      confidence: 0.98
    };
  }

  // 2. Ordinals (2nd, second, option 2, the second one, show the second one, dusra wala, etc.)
  const isSecondOrdinal =
    /\b(?:show\s+(?:me\s+)?)?(?:2nd\s+(?:one|laptop|option|model)|second\s+(?:one|laptop|option|model)|the\s+second|the\s+2nd|number\s+2|option\s+2|the\s+latter|dusra\s+wala|doosra\s+wala)\b/i.test(lower) ||
    /^(2nd|second|2|opt\s*2|dusra|doosra)$/i.test(lower) ||
    /\b(?:i\s+think\s+)?(?:2nd|second)\s+(?:one\s+)?(?:fits\s+me|is\s+better|looks\s+good|works)\b/i.test(lower) ||
    /\b(?:i\s+prefer|i'll\s+take|i\s+want|take|choose|like)\s+(?:the\s+)?(?:2nd|second)(?:\s+one)?\b/i.test(lower);

  if (isSecondOrdinal && list.length >= 2) {
    return {
      type: 'ORDINAL',
      index: 2,
      targetProduct: list[1],
      modelName: `${list[1].brand} ${list[1].model}`,
      confidence: 0.98
    };
  }

  // 3. Ordinal 3 (3rd, third, teesra wala, etc.)
  const isThirdOrdinal =
    /\b(?:show\s+(?:me\s+)?)?(?:3rd\s+(?:one|laptop|option|model)|third\s+(?:one|laptop|option|model)|the\s+third|the\s+3rd|number\s+3|option\s+3|teesra\s+wala)\b/i.test(lower) ||
    /^(3rd|third|3|opt\s*3|teesra)$/i.test(lower);

  if (isThirdOrdinal && list.length >= 3) {
    return {
      type: 'ORDINAL',
      index: 3,
      targetProduct: list[2],
      modelName: `${list[2].brand} ${list[2].model}`,
      confidence: 0.98
    };
  }

  // 4. Comparative Price (the cheaper one, cheaper laptop, lowest price, sasta wala)
  const isCheaperSelector = /\b(the\s+cheaper\s+(?:one|laptop|option|model)|cheaper\s+one|lowest\s+price|more\s+affordable|sasta\s+wala|kam\s+price\s+wala)\b/i.test(lower);
  if (isCheaperSelector && list.length >= 2) {
    const sorted = [...list].sort((a, b) => (a.price || 0) - (b.price || 0));
    return {
      type: 'COMPARATIVE_PRICE',
      index: sorted[0].index || 1,
      targetProduct: sorted[0],
      modelName: `${sorted[0].brand} ${sorted[0].model}`,
      confidence: 0.95
    };
  }

  // 5. Alternate (the other one, the other laptop, dusra wala)
  const isOtherSelector = /\b(the\s+other\s+(?:one|laptop|option|model)|other\s+one|the\s+other|what\s+about\s+the\s+other\s+one)\b/i.test(lower);
  if (isOtherSelector) {
    if (list.length >= 2) {
      return {
        type: 'ALTERNATE_SELECTOR',
        index: 2,
        targetProduct: list[1],
        modelName: `${list[1].brand} ${list[1].model}`,
        confidence: 0.92
      };
    }
    return {
      type: 'AMBIGUOUS_OTHER',
      index: null,
      targetProduct: null,
      modelName: null,
      confidence: 0.5
    };
  }

  // 5.5 Brand-Targeted Selection (the Dell one, the HP one, Dell wala, HP wala)
  const brandTargetMatch = lower.match(/\b(?:the\s+)?(dell|hp|lenovo|asus|acer|apple|macbook)\s+(?:one|laptop|model|wala)\b/i);
  if (brandTargetMatch && list.length >= 1) {
    const targetBrand = brandTargetMatch[1].toLowerCase();
    const matched = list.find(p => p.brand.toLowerCase() === targetBrand);
    if (matched) {
      return {
        type: 'BRAND_TARGETED',
        index: matched.index || 1,
        targetProduct: matched,
        modelName: `${matched.brand} ${matched.model}`,
        confidence: 0.96
      };
    }
  }

  // 6. Referential Pronoun Target Binding ("its price", "how much", "its warranty", "is it available", "how much RAM does it have?")
  const isPronounTarget = /\b(its\s+price|how\s+much(?:\s+is\s+it)?|price\??|cost\??|its\s+warranty|warranty\s+for\s+this|is\s+it\s+available|is\s+this\s+available|available\??|in\s+stock\??|stock\s+hai\??|iska\s+price|kitne\s+ka\s+hai|iski\s+warranty|available\s+hai(?:\s+kya)?|how\s+much\s+ram|what\s+processor|what\s+storage|which\s+processor)\b/i.test(lower);
  if (isPronounTarget && list.length === 1) {
    return {
      type: 'PRONOUN_BINDING',
      index: 1,
      targetProduct: list[0],
      modelName: `${list[0].brand} ${list[0].model}`,
      confidence: 0.96
    };
  }

  return null;
};

/**
 * Product Search Safety Gate.
 * Determines if product search execution is permitted on the current turn.
 */
export const canExecuteProductSearch = (context = {}) => {
  const { currentTurn = {}, intent, searchAllowed } = context;
  if (searchAllowed === false) return false;
  if (intent !== 'PRODUCT_SEARCH') return false;

  const text = currentTurn.normalizedText || '';
  if (CONVERSATIONAL_QUESTION_PATTERNS.some(p => p.test(text))) return false;

  const hasBrand = BRAND_PATTERNS.test(text);
  const hasPrice = PRICE_LIMIT_PATTERNS.test(text);
  const hasRam = RAM_PATTERNS.test(text);
  const hasStorage = STORAGE_PATTERNS.test(text);
  const hasUseCase = USE_CASE_PATTERNS.test(text);
  const hasLaptopKeyword = /\b(laptops?|notebooks?|macbooks?|pcs?|systems?|computers?)\b/i.test(text);
  const hasSearchVerbs = /\b(show\s+(?:me\s+)?|find|search|looking\s+for|i\s+want|i\s+need|suggest|recommend|give\s+me|options?|list|buy|purchase|needed|want\s+to\s+buy)\b/i.test(text);
  const hasModelName = MODEL_PATTERNS.some(p => p.regex.test(text));
  const hasOverrideLead = /\b(actually|instead|needed|meant|only)\b/i.test(text);

  if (hasBrand && (hasLaptopKeyword || hasSearchVerbs || hasPrice || hasRam || hasStorage || hasUseCase || hasModelName || hasOverrideLead)) {
    return true;
  }
  if (hasModelName || hasPrice || hasRam || hasStorage) return true;
  if (hasUseCase && (hasLaptopKeyword || hasSearchVerbs)) return true;
  if (hasLaptopKeyword && hasSearchVerbs) return true;

  return false;
};

/**
 * Response Safety & Quality Validator.
 * Verifies that the final assistant response strictly adheres to the current intent and constraints.
 */
export const validateResponse = (response = {}, context = {}) => {
  if (!response || !response.reply) {
    return {
      isValid: false,
      reason: 'Empty response body'
    };
  }

  const reply = response.reply;
  const { intent, searchAllowed, currentTurnRequirements = {} } = context;

  // 1. If search is blocked, response must NOT return a product list
  if (searchAllowed === false && (intent === 'CLARIFICATION' || intent === 'DELIVERY_QUERY' || intent === 'WARRANTY_QUERY' || intent === 'RETURN_POLICY' || intent === 'REFUND_POLICY' || intent === 'EMI_QUERY')) {
    if (reply.includes('1. *') && reply.includes('2. *') && reply.includes('₹')) {
      return {
        isValid: false,
        reason: 'Policy or conversational turn attempted to return product search results'
      };
    }
  }

  // 2. Response source must never be UNKNOWN
  if (!response.responseSource || response.responseSource === 'UNKNOWN') {
    return {
      isValid: false,
      reason: 'Invalid response source UNKNOWN'
    };
  }

  return {
    isValid: true,
    reason: 'Validated'
  };
};
