/**
 * Pending Assistant Action & Follow-up State Service.
 * Reconstructs and resolves the conversational state from the immediately preceding assistant message.
 *
 * Implements strict action precedence:
 * 1. Explicit current-message intent/action (e.g. "show me Lenovo laptops", "compare them", "check warranty")
 * 2. Pending action from immediately previous assistant message
 * 3. Current-turn product references / pronouns ("the first one", "which is cheaper?")
 * 4. Active products from previous assistant turn
 * 5. Historical requirements (with stale constraint isolation)
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const fallbackProductsPath = path.resolve(__dirname, '../data/products.json');

let cachedProducts = null;
const getCatalog = () => {
  if (!cachedProducts) {
    try {
      cachedProducts = JSON.parse(fs.readFileSync(fallbackProductsPath, 'utf-8'));
    } catch {
      cachedProducts = [];
    }
  }
  return cachedProducts;
};

const MODEL_NAME_REGEX = /\b(Pavilion(?:\s*15)?|ProBook(?:\s*\d+)?|EliteBook(?:\s*\d+)?|Victus(?:\s*\d+)?|ThinkPad(?:\s*[ETL]\d+)?|IdeaPad(?:\s*Slim\s*\d+)?|Legion(?:\s*\d+)?|LOQ(?:\s*\d+)?|Inspiron(?:\s*\d+)?|Vostro(?:\s*\d+)?|Latitude(?:\s*\d+)?|G15|Vivobook(?:\s*\d+)?|Zenbook(?:\s*\d+)?|TUF(?:\s*Gaming)?|ROG(?:\s*Strix)?|Aspire(?:\s*\d+)?|Swift(?:\s*Go)?|Nitro(?:\s*V)?|MacBook(?:\s*Air)?|HP\s*15s)\b/gi;

const BRAND_PREFIX_REGEX = /\b(HP|Lenovo|Dell|ASUS|Acer|Apple)\s+(Pavilion(?:\s*15)?|ProBook(?:\s*\d+)?|EliteBook(?:\s*\d+)?|Victus(?:\s*\d+)?|ThinkPad(?:\s*[ETL]\d+)?|IdeaPad(?:\s*Slim\s*\d+)?|Legion(?:\s*\d+)?|LOQ(?:\s*\d+)?|Inspiron(?:\s*\d+)?|Vostro(?:\s*\d+)?|Latitude(?:\s*\d+)?|G15|Vivobook(?:\s*\d+)?|Zenbook(?:\s*\d+)?|TUF(?:\s*Gaming)?|ROG(?:\s*Strix)?|Aspire(?:\s*\d+)?|Swift(?:\s*Go)?|Nitro(?:\s*V)?|MacBook(?:\s*Air)?|15s)\b/gi;

const CONFIRMATION_PATTERNS = /^(yes|yeah|yep|yup|sure|okay|ok|y|haan|ha|theek\s+hai|please\s+do|do\s+it|show\s+me|send\s+it|go\s+ahead|tell\s+me|show|definitely|absolutely|fine|why\s+not|that\s+sounds\s+good)[\.\!\?]*$/i;

/**
 * Extracts structured active products presented in an assistant message.
 */
export const extractActiveProducts = (assistantMessage = '') => {
  if (!assistantMessage || typeof assistantMessage !== 'string') return [];

  const found = [];
  let match;

  // Try matching full Brand + Model (e.g. "HP Pavilion 15")
  const brandModelRegex = new RegExp(BRAND_PREFIX_REGEX.source, 'gi');
  while ((match = brandModelRegex.exec(assistantMessage)) !== null) {
    const fullName = `${match[1]} ${match[2]}`.trim();
    if (!found.some((p) => p.toLowerCase() === fullName.toLowerCase())) {
      found.push(fullName);
    }
  }

  // If none found with brand prefix, look for model names
  if (found.length === 0) {
    const singleModelRegex = new RegExp(MODEL_NAME_REGEX.source, 'gi');
    while ((match = singleModelRegex.exec(assistantMessage)) !== null) {
      const modelName = match[1].trim();
      if (!found.some((p) => p.toLowerCase() === modelName.toLowerCase())) {
        found.push(modelName);
      }
    }
  }

  return found;
};

/**
 * Parses the pending action offered by the assistant in its latest message.
 */
export const parsePendingAssistantAction = (lastAssistantMessage = '') => {
  if (!lastAssistantMessage || typeof lastAssistantMessage !== 'string') {
    return {
      type: 'NONE',
      offeredActions: [],
      activeProducts: [],
      createdFromMessage: ''
    };
  }

  const activeProducts = extractActiveProducts(lastAssistantMessage);
  const offeredActions = [];

  const lower = lastAssistantMessage.toLowerCase();

  const offersComparison = /\b(compare\s+(?:any\s+of\s+these|these|them|the\s+models|the\s+first\s+two)|compare\b)/i.test(lower);
  const offersWarranty = /\b(warranty\s+details|check\s+warranty|warranty\s+information|warranty\b)/i.test(lower);
  const offersShowProducts = /\b(show\s+(?:available\s+)?[a-zA-Z0-9\s]*laptops|show\s+you\s+available)/i.test(lower);
  const offersSpecifications = /\b(more\s+details|specifications|specs)/i.test(lower);

  if (offersComparison) offeredActions.push('COMPARE_PRODUCTS');
  if (offersWarranty) offeredActions.push('CHECK_WARRANTY');
  if (offersShowProducts) offeredActions.push('SHOW_PRODUCTS');
  if (offersSpecifications && !offersComparison && !offersWarranty) offeredActions.push('SHOW_DETAILS');

  return {
    type: offeredActions.length > 0 ? 'PRODUCT_FOLLOWUP' : activeProducts.length > 0 ? 'ACTIVE_CONTEXT' : 'NONE',
    offeredActions,
    activeProducts,
    createdFromMessage: lastAssistantMessage.trim()
  };
};

/**
 * Resolves customer follow-up message against the pending assistant action and active product set.
 *
 * @param {string} currentMessage
 * @param {object} pendingAction
 * @param {object} historicalRequirements
 * @returns {object} Resolved intent, target action, active products, direct reply (if applicable), and clarification state
 */
export const resolveFollowUpState = (
  currentMessage = '',
  pendingAction = null,
  historicalRequirements = {}
) => {
  const text = (currentMessage || '').trim();
  const lower = text.toLowerCase();
  const isConfirm = CONFIRMATION_PATTERNS.test(text);

  const activeProducts = pendingAction?.activeProducts || [];
  const offeredActions = pendingAction?.offeredActions || [];

  const resolution = {
    isFollowUp: false,
    selectedAction: null,
    targetIntent: null,
    activeProducts,
    isAmbiguous: false,
    directReply: null,
    clarificationMessage: null,
    staleRequirementsIgnored: null
  };

  // Case 1: Entity Query - "Which one is cheaper?" / "Which is cheaper?"
  if (/\b(which\s+(?:one\s+is|is)\s+cheaper|cheaper\s+one|cheapest)\b/i.test(lower) && activeProducts.length >= 2) {
    resolution.isFollowUp = true;
    resolution.selectedAction = 'CHEAPEST_COMPARISON';
    resolution.targetIntent = 'CHEAPEST_COMPARISON';
    resolution.staleRequirementsIgnored = { ...historicalRequirements };

    const catalog = getCatalog();
    const matched = activeProducts.map((name) => {
      const found = catalog.find((c) => `${c.brand} ${c.model}`.toLowerCase().includes(name.toLowerCase()) || name.toLowerCase().includes(c.model.toLowerCase()));
      return found || { brand: '', model: name, price: 0 };
    }).filter((p) => p.price > 0);

    if (matched.length >= 2) {
      matched.sort((a, b) => a.price - b.price);
      const cheaper = matched[0];
      const other = matched[1];
      const diff = Math.abs(other.price - cheaper.price);
      resolution.directReply = `Between the *${cheaper.brand} ${cheaper.model}* (₹${cheaper.price.toLocaleString('en-IN')}) and *${other.brand} ${other.model}* (₹${other.price.toLocaleString('en-IN')}), the *${cheaper.brand} ${cheaper.model}* is cheaper by *₹${diff.toLocaleString('en-IN')}*.`;
    }
    return resolution;
  }

  // Case 2: Entity Reference - "the first one" / "the second one" / "the other one"
  if (/\b(the\s+first\s+one|first\s+laptop|first\s+one|the\s+first)\b/i.test(lower) && activeProducts.length >= 1) {
    resolution.isFollowUp = true;
    resolution.selectedAction = 'SPECIFIC_PRODUCT_DETAILS';
    resolution.targetIntent = 'PRODUCT_SEARCH';
    resolution.activeProducts = [activeProducts[0]];
    resolution.staleRequirementsIgnored = { ...historicalRequirements };
    return resolution;
  }
  if (/\b(the\s+second\s+one|second\s+laptop|second\s+one|the\s+second|the\s+other\s+one|other\s+one|other\s+laptop|the\s+other|what\s+about\s+the\s+other\s+one)\b/i.test(lower) && activeProducts.length >= 2) {
    resolution.isFollowUp = true;
    resolution.selectedAction = 'SPECIFIC_PRODUCT_DETAILS';
    resolution.targetIntent = 'PRODUCT_SEARCH';
    resolution.activeProducts = [activeProducts[1]];
    resolution.staleRequirementsIgnored = { ...historicalRequirements };
    return resolution;
  }

  // Case 3: Explicit comparison intent (e.g. "compare them", "compare Pavilion and Victus", "compare both")
  if (/\b(compare\s+(?:them|these|both|the\s+two)|compare\b)/i.test(lower) && !/^(show\s+me|laptops\s+under|find)/i.test(lower)) {
    resolution.isFollowUp = true;
    resolution.selectedAction = 'COMPARE_PRODUCTS';
    resolution.targetIntent = 'PRODUCT_COMPARISON';
    resolution.staleRequirementsIgnored = { ...historicalRequirements };
    return resolution;
  }

  // Case 4: Explicit warranty inquiry on active context (e.g. "check warranty", "what about warranty?", "warranty for Pavilion", "does Victus have warranty?")
  if (/\b(warranty|guarantee|warranty\s+details|check\s+warranty|what\s+about\s+warranty)\b/i.test(lower)) {
    resolution.isFollowUp = true;
    resolution.selectedAction = 'CHECK_WARRANTY';
    resolution.targetIntent = 'WARRANTY_QUERY';

    // Check if customer narrowed to a specific active product
    let specificTarget = null;
    if (/\b(first\s+one|the\s+first)\b/i.test(lower)) {
      specificTarget = activeProducts[0];
    } else if (/\b(second\s+one|the\s+second)\b/i.test(lower) && activeProducts.length >= 2) {
      specificTarget = activeProducts[1];
    } else {
      const modelMatch = text.match(/\b(Pavilion|Victus|ThinkPad|IdeaPad|Inspiron|Vostro|MacBook|ProBook|EliteBook|Legion|LOQ|Vivobook|Zenbook|TUF|ROG|Aspire|Swift|Nitro|15s)\b/i);
      if (modelMatch) {
        specificTarget = activeProducts.find((p) => new RegExp(modelMatch[1], 'i').test(p));
      }
    }
    if (specificTarget) {
      resolution.activeProducts = [specificTarget];
    }

    resolution.staleRequirementsIgnored = { ...historicalRequirements };
    return resolution;
  }

  // Case 5: Ambiguous "show me" / "show them" / "tell me more" when products were already presented
  if (/^(show\s+(?:me|them|those)|tell\s+me\s+(?:more|about\s+them)|more\s+details)$/i.test(lower) && activeProducts.length >= 2) {
    resolution.isFollowUp = true;
    resolution.isAmbiguous = true;
    resolution.selectedAction = 'AMBIGUOUS_SHOW';
    resolution.targetIntent = 'CLARIFICATION';
    resolution.clarificationMessage = `Sure — would you like more details for the *${activeProducts[0]}* or the *${activeProducts[1]}*?`;
    resolution.staleRequirementsIgnored = { ...historicalRequirements };
    return resolution;
  }

  // Case 6: Confirmation response ("yes", "sure", "ok", "please do")
  if (isConfirm && pendingAction && (pendingAction.type === 'PRODUCT_FOLLOWUP' || pendingAction.type === 'ACTIVE_CONTEXT')) {
    resolution.isFollowUp = true;

    // A. Single Action Offered: Resolve directly
    if (offeredActions.length === 1) {
      const singleAction = offeredActions[0];
      resolution.selectedAction = singleAction;

      if (singleAction === 'COMPARE_PRODUCTS') {
        resolution.targetIntent = 'PRODUCT_COMPARISON';
      } else if (singleAction === 'CHECK_WARRANTY') {
        resolution.targetIntent = 'WARRANTY_QUERY';
      } else if (singleAction === 'SHOW_PRODUCTS') {
        resolution.targetIntent = 'CONFIRMATION';
      } else {
        resolution.targetIntent = 'PRODUCT_COMPARISON';
      }

      resolution.staleRequirementsIgnored = { ...historicalRequirements };
      return resolution;
    }

    // B. Multiple Actions Offered (e.g. "compare or check warranty"): Ambiguous
    if (offeredActions.length > 1) {
      resolution.isAmbiguous = true;
      resolution.selectedAction = 'AMBIGUOUS';
      resolution.targetIntent = 'CLARIFICATION';

      const prodListStr = activeProducts.length >= 2 ? `the *${activeProducts[0]}* and *${activeProducts[1]}*` : 'these models';

      resolution.clarificationMessage = `Sure! Would you like me to:\n1. Compare ${prodListStr}, or\n2. Check their warranty details?`;
      resolution.staleRequirementsIgnored = { ...historicalRequirements };
      return resolution;
    }
  }

  return resolution;
};
