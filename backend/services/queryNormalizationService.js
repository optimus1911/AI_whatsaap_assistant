/**
 * queryNormalizationService.js
 *
 * Generalized text normalization, typo correction, and policy signal detection
 * for incoming WhatsApp customer messages.
 *
 * Works fully deterministically — no Gemini dependency.
 *
 * Pipeline:
 *   RAW MESSAGE → TEXT NORMALIZATION → TYPO CORRECTION → POLICY SIGNAL DETECTION → OUTPUT
 */

// ============================================================
// 1. COMMON TYPO / MISSPELLING CORRECTIONS (word-level)
// ============================================================
// Maps misspelled words to their correct forms.
// This is intentionally broad but weighted toward sales/support vocabulary.
const WORD_CORRECTIONS = new Map([
  // Filler / question words
  ['wat', 'what'], ['whta', 'what'], ['waht', 'what'], ['wht', 'what'],
  ['whar', 'what'], ['wha', 'what'], ['whats', "what's"],
  ['si', 'is'], ['iz', 'is'], ['iss', 'is'],
  ['teh', 'the'], ['hte', 'the'],
  ['fo', 'for'], ['fro', 'for'], ['fot', 'for'],
  ['adn', 'and'], ['nad', 'and'],
  ['hwo', 'how'], ['hw', 'how'],
  ['yor', 'your'], ['yur', 'your'], ['ur', 'your'],
  ['abut', 'about'], ['abuot', 'about'], ['abour', 'about'],
  ['dose', 'does'], ['doees', 'does'],
  ['thsi', 'this'], ['tihs', 'this'],
  ['wiht', 'with'], ['wtih', 'with'], ['iwth', 'with'],
  ['hav', 'have'], ['ahve', 'have'],
  ['cna', 'can'], ['acn', 'can'],
  ['pls', 'please'], ['plz', 'please'], ['plese', 'please'],
  ['thnk', 'think'], ['thnks', 'thanks'], ['thx', 'thanks'],
  ['whn', 'when'], ['wehn', 'when'],
  ['mny', 'many'], ['mnay', 'many'],
  ['lng', 'long'], ['logn', 'long'],
  ['tiem', 'time'], ['itme', 'time'], ['tmie', 'time'],
  ['avilable', 'available'], ['avialable', 'available'], ['availble', 'available'],
  ['availabel', 'available'], ['avaialble', 'available'], ['avilabel', 'available'],

  // Business / policy terms
  ['delivary', 'delivery'], ['delivry', 'delivery'], ['ddelivery', 'delivery'],
  ['deliveryy', 'delivery'], ['deilvery', 'delivery'], ['delivey', 'delivery'],
  ['deliveri', 'delivery'], ['delvery', 'delivery'], ['deliverr', 'delivery'],
  ['shiping', 'shipping'], ['shpping', 'shipping'], ['shippping', 'shipping'],
  ['shipment', 'shipping'],
  ['retun', 'return'], ['retrun', 'return'], ['retrn', 'return'],
  ['reutrn', 'return'], ['returm', 'return'], ['reurn', 'return'],
  ['refnd', 'refund'], ['refun', 'refund'], ['reffund', 'refund'],
  ['refudn', 'refund'], ['rfund', 'refund'],
  ['warrnty', 'warranty'], ['waranty', 'warranty'], ['warrantty', 'warranty'],
  ['warrenty', 'warranty'], ['warnty', 'warranty'], ['guarentee', 'guarantee'],
  ['guarnatee', 'guarantee'], ['gurantee', 'guarantee'],
  ['exchnge', 'exchange'], ['exhange', 'exchange'], ['exchnage', 'exchange'],
  ['exchagne', 'exchange'], ['exchang', 'exchange'], ['exhcange', 'exchange'],
  ['emii', 'emi'], ['intstallment', 'installment'], ['instalment', 'installment'],
  ['installemnts', 'installments'], ['instalments', 'installments'],
  ['cancellaton', 'cancellation'], ['cancelation', 'cancellation'],
  ['cancle', 'cancel'], ['cancell', 'cancel'], ['canel', 'cancel'],
  ['polcy', 'policy'], ['plicy', 'policy'], ['poilcy', 'policy'],
  ['policiy', 'policy'], ['ploicy', 'policy'],

  // Product-adjacent terms (preserve intent)
  ['lapotp', 'laptop'], ['laptp', 'laptop'], ['loptap', 'laptop'],
  ['latpop', 'laptop'], ['labtop', 'laptop'], ['lapttop', 'laptop'],
  ['laptpo', 'laptop'], ['lpatop', 'laptop'],
  ['udner', 'under'], ['undr', 'under'], ['uner', 'under'],
  ['buget', 'budget'], ['budjet', 'budget'], ['bugdet', 'budget'],
  ['priice', 'price'], ['pirce', 'price'], ['pricee', 'price'],
  ['compre', 'compare'], ['comparee', 'compare'], ['compar', 'compare'],

  // Brand typo corrections (contextual vocabulary)
  ['del', 'dell'], ['dle', 'dell'], ['dlel', 'dell'],
  ['lenevo', 'lenovo'], ['lenov', 'lenovo'], ['lenvo', 'lenovo'],
  ['asuss', 'asus'], ['asuz', 'asus'],
  ['acerr', 'acer'],
  ['applr', 'apple'], ['aple', 'apple'],
  ['hpp', 'hp'],

  // Hinglish common
  ['kitne', 'kitne'], ['kab', 'kab'], ['milega', 'milega'],
  ['hogi', 'hogi'], ['kya', 'kya'], ['hai', 'hai'],
  ['sakta', 'sakta'], ['kitni', 'kitni'], ['kaise', 'kaise'],
]);

// ============================================================
// 2. LEVENSHTEIN DISTANCE (for fuzzy matching)
// ============================================================
function levenshtein(a, b) {
  if (a === b) return 0;
  if (a.length === 0) return b.length;
  if (b.length === 0) return a.length;

  const matrix = [];
  for (let i = 0; i <= b.length; i++) matrix[i] = [i];
  for (let j = 0; j <= a.length; j++) matrix[0][j] = j;

  for (let i = 1; i <= b.length; i++) {
    for (let j = 1; j <= a.length; j++) {
      const cost = b[i - 1] === a[j - 1] ? 0 : 1;
      matrix[i][j] = Math.min(
        matrix[i - 1][j] + 1,
        matrix[i][j - 1] + 1,
        matrix[i - 1][j - 1] + cost
      );
    }
  }
  return matrix[b.length][a.length];
}

// ============================================================
// 3. POLICY TERM DICTIONARY (canonical → fuzzy variants + Hinglish)
// ============================================================
const POLICY_TERMS = {
  delivery: {
    canonical: 'delivery',
    category: 'shipping',
    intent: 'DELIVERY_QUERY',
    variants: ['delivery', 'delivary', 'delivry', 'ddelivery', 'deliveryy', 'deilvery',
               'delivey', 'deliveri', 'delvery', 'shipping', 'shiping', 'shpping',
               'dispatch', 'courier', 'arrival', 'arrive', 'arrives'],
    hinglish: ['kitne din', 'kab milega', 'kab aayega', 'kab tak', 'kitna time'],
    phrasePatterns: [
      /\b(?:deliver(?:y|ary|ry|ivery)?|shipping?|dispatch)\s*(?:time|date|status|charge|fee|days?)?\b/i,
      /\b(?:how\s+(?:long|many\s+days?|much\s+time)|when\s+(?:will|does|can)|arrival\s+time)\b/i,
      /\bkab\s+(?:milega|aayega|tak)\b/i,
      /\bkitne?\s+din\b/i,
      /\blaptop\s+kab\s+milega\b/i,
      /\bwhen\s+(?:will\s+(?:i\s+(?:get|receive)|it\s+(?:arrive|come|reach))|(?:can|do)\s+i\s+(?:get|receive|expect))\b/i,
    ]
  },
  returns: {
    canonical: 'return',
    category: 'returns',
    intent: 'RETURN_POLICY',
    variants: ['return', 'retun', 'retrun', 'retrn', 'reutrn', 'returm', 'reurn',
               'returns', 'returning'],
    hinglish: ['wapas', 'vapas', 'return ho', 'return kar'],
    phrasePatterns: [
      /\b(?:return(?:s|ing)?|retun|retrun)\s*(?:policy|process|time|possible|this)?\b/i,
      /\bcan\s+(?:i\s+)?return\b/i,
      /\bwapas|vapas\b/i,
      /\breturn\s+ho\s+sakta\b/i,
    ]
  },
  refund: {
    canonical: 'refund',
    category: 'refunds',
    intent: 'REFUND_POLICY',
    variants: ['refund', 'refnd', 'refun', 'reffund', 'refudn', 'rfund',
               'money back', 'moneyback'],
    hinglish: ['paisa wapas', 'paise wapas', 'refund kab'],
    phrasePatterns: [
      /\b(?:refund|refnd|refun|reffund|money\s*back)\s*(?:policy|time|status|process|kab)?\b/i,
      /\bpais[ae]\s+wapas\b/i,
    ]
  },
  warranty: {
    canonical: 'warranty',
    category: 'warranty',
    intent: 'WARRANTY_QUERY',
    variants: ['warranty', 'warrnty', 'waranty', 'warrantty', 'warrenty', 'warnty',
               'guarantee', 'guarentee', 'guarnatee', 'gurantee'],
    hinglish: ['warranty kitni', 'guarantee hai', 'warranty hai'],
    phrasePatterns: [
      /\b(?:warrant(?:y|ty|nty)|waranty|warrnty|warrenty|warnty|guarant(?:ee|y)|guarentee|gurantee)\s*(?:policy|period|details?|cover(?:age)?|for|kitni|hai|time)?\b/i,
      /\bwarranty\s+kitni\s+hai\b/i,
    ]
  },
  exchange: {
    canonical: 'exchange',
    category: 'exchanges',
    intent: 'EXCHANGE_POLICY',
    variants: ['exchange', 'exchnge', 'exhange', 'exchnage', 'exchagne', 'exchang',
               'replacement', 'swap'],
    hinglish: ['badal', 'badalna', 'exchange kar'],
    phrasePatterns: [
      /\b(?:exchang(?:e|ge|age|nge)?|exchnge|exhange|replacement|swap)\s*(?:policy|process|possible)?\b/i,
      /\bbadal(?:na)?\b/i,
    ]
  },
  emi: {
    canonical: 'emi',
    category: 'payment',
    intent: 'EMI_QUERY',
    variants: ['emi', 'emii', 'installment', 'installments', 'instalment', 'instalments',
               'monthly payment', 'no cost emi'],
    hinglish: ['emi hai kya', 'kist', 'emi milega', 'emi available'],
    phrasePatterns: [
      /\b(?:emi+|install?ments?|monthly\s+payment|no\s+cost\s+emi)\s*(?:available|hai|kya|option|plan|milega)?\b/i,
      /\bemi\s+hai\s+kya\b/i,
      /\bdo\s+you\s+(?:have|offer)\s+emi\b/i,
    ]
  },
  cod: {
    canonical: 'cod',
    category: 'payment',
    intent: 'COD_QUERY',
    variants: ['cod', 'cash on delivery', 'cash delivery', 'pay on delivery'],
    hinglish: ['cod hai kya', 'cod available', 'cash on delivary'],
    phrasePatterns: [
      /\b(?:c\.?o\.?d\.?|cash\s+on\s+deliver(?:y|ary)|pay\s+on\s+delivery|cash\s+deliver(?:y|ary))\s*(?:available|hai|kya)?\b/i,
    ]
  },
  cancellation: {
    canonical: 'cancellation',
    category: 'cancellation',
    intent: 'CANCELLATION_QUERY',
    variants: ['cancel', 'cancellation', 'cancle', 'cancell', 'canel', 'cancelation'],
    hinglish: ['cancel karna', 'cancel karo', 'order cancel'],
    phrasePatterns: [
      /\b(?:cancel(?:l?ation)?|cancle|canel)\s*(?:order|policy|process|karna|karo)?\b/i,
    ]
  },
  damaged: {
    canonical: 'damaged',
    category: 'support',
    intent: 'SUPPORT_QUERY',
    variants: ['damaged', 'broken', 'tampered', 'defect', 'faulty', 'dented'],
    hinglish: ['tuta', 'toota', 'kharab'],
    phrasePatterns: [
      /\b(?:damaged|broken|tampered|defect(?:ive)?|faulty|dented)\b/i,
      /\btut[ae]|toot[ae]|kharab\b/i,
    ]
  },
  student_discount: {
    canonical: 'student discount',
    category: 'discounts',
    intent: 'DISCOUNT_QUERY',
    variants: ['student discount', 'college discount', 'education discount'],
    hinglish: ['student offer', 'college wala discount'],
    phrasePatterns: [
      /\b(?:student|college|education)\s+discount\b/i,
    ]
  },
};

// ============================================================
// 4. PROTECTED TERMS (never rewrite these)
// ============================================================
const PROTECTED_PATTERNS = [
  // Brand names
  /\b(HP|Lenovo|Dell|ASUS|Acer|Apple|MacBook|Samsung|MSI|Razer)\b/i,
  // Model names
  /\b(Pavilion|Victus|ThinkPad|IdeaPad|Inspiron|Vostro|ProBook|EliteBook|Legion|LOQ|Vivobook|Zenbook|TUF|ROG|Aspire|Swift|Nitro|15s|MacBook\s*(?:Air|Pro)?)\b/i,
  // Technical specs: RAM, storage, processors
  /\b\d+\s*(?:GB|TB|MHz|GHz)\b/i,
  /\b(?:i[3579]|Ryzen\s*[3579]|Core)\b/i,
  /\b(?:RTX|GTX|MX|Iris|Radeon)\b/i,
  // Prices / numbers
  /(?:₹|rs\.?|inr)\s*\d/i,
  /\b\d{4,}\b/,
];

function isProtectedWord(word, originalIndex, words) {
  // Only protect the word itself — don't let neighboring brands/prices block correction
  return PROTECTED_PATTERNS.some(p => p.test(word));
}

// ============================================================
// 5. CORE NORMALIZATION FUNCTION
// ============================================================

/**
 * Normalizes a customer message: corrects typos, detects policy signals,
 * preserves product/brand/price terms.
 *
 * @param {string} message - Raw customer WhatsApp message
 * @returns {{
 *   originalText: string,
 *   normalizedText: string,
 *   corrections: string[],
 *   confidence: number,
 *   policySignals: string[],
 *   productSignals: string[]
 * }}
 */
export const normalizeCustomerMessage = (message = '') => {
  const originalText = (message || '').trim();
  if (!originalText) {
    return {
      originalText: '',
      normalizedText: '',
      corrections: [],
      confidence: 1.0,
      policySignals: [],
      productSignals: [],
    };
  }

  const corrections = [];

  // Pre-normalize common spaced multi-token brand typos (e.g. "de ll" -> "dell", "le novo" -> "lenovo")
  let preprocessedText = originalText
    .replace(/\bde\s+ll\b/gi, 'dell')
    .replace(/\ble\s+novo\b/gi, 'lenovo')
    .replace(/\ba\s+sus\b/gi, 'asus')
    .replace(/\ba\s+cer\b/gi, 'acer');

  if (preprocessedText !== originalText) {
    corrections.push(`spaced brand correction -> ${preprocessedText}`);
  }

  // ----- Step 1: Word-level typo correction -----
  const words = preprocessedText.split(/\s+/);
  const correctedWords = words.map((word, idx) => {
    const lowerWord = word.toLowerCase().replace(/[?.!,]+$/, '');
    const punctuation = word.match(/[?.!,]+$/)?.[0] || '';

    // Don't correct protected words
    if (isProtectedWord(word, idx, words)) return word;

    // Don't correct numbers
    if (/^\d+$/.test(lowerWord)) return word;

    // Don't correct very short words (1 char)
    if (lowerWord.length <= 1 && !WORD_CORRECTIONS.has(lowerWord)) return word;

    // Direct dictionary lookup
    if (WORD_CORRECTIONS.has(lowerWord)) {
      const corrected = WORD_CORRECTIONS.get(lowerWord);
      if (corrected !== lowerWord) {
        corrections.push(`${lowerWord} -> ${corrected}`);
        return corrected + punctuation;
      }
      return word;
    }

    // Fuzzy match against policy term CANONICAL forms only (edit distance ≤ 2 for words ≥ 4 chars)
    // This prevents correct words being "corrected" to typo variants
    if (lowerWord.length >= 4) {
      let bestMatch = null;
      let bestDist = Infinity;

      for (const termGroup of Object.values(POLICY_TERMS)) {
        const canonical = termGroup.canonical;
        if (lowerWord === canonical) {
          bestMatch = null; // Word is already correct
          break;
        }
        const dist = levenshtein(lowerWord, canonical);
        const threshold = canonical.length <= 4 ? 1 : 2;
        if (dist > 0 && dist <= threshold && dist < lowerWord.length * 0.5 && dist < bestDist) {
          bestMatch = canonical;
          bestDist = dist;
        }
      }

      if (bestMatch) {
        corrections.push(`${lowerWord} -> ${bestMatch}`);
        return bestMatch + punctuation;
      }
    }

    return word;
  });

  const normalizedText = correctedWords.join(' ');

  // ----- Step 2: Detect policy signals from normalized text -----
  const policySignals = [];
  const normalizedLower = normalizedText.toLowerCase();

  for (const [, termDef] of Object.entries(POLICY_TERMS)) {
    // Check phrase patterns
    const matchesPhrase = termDef.phrasePatterns.some(p => p.test(normalizedLower));

    // Check single-word variant presence
    const matchesVariant = termDef.variants.some(v => {
      if (v.includes(' ')) {
        return normalizedLower.includes(v);
      }
      return new RegExp(`\\b${v}\\b`, 'i').test(normalizedLower);
    });

    // Check Hinglish patterns
    const matchesHinglish = termDef.hinglish.some(h => normalizedLower.includes(h));

    if (matchesPhrase || matchesVariant || matchesHinglish) {
      if (!policySignals.includes(termDef.intent)) {
        policySignals.push(termDef.intent);
      }
    }
  }

  // ----- Step 3: Detect product signals from normalized text -----
  const productSignals = [];

  // Brand mention
  if (/\b(HP|Lenovo|Dell|ASUS|Acer|Apple|MacBook)\b/i.test(normalizedText)) {
    productSignals.push('BRAND_MENTION');
  }
  // Price mention
  if (/(?:under|below|less\s+than|within|budget|around|₹|rs\.?|inr)\s*\d/i.test(normalizedLower) ||
      /\b\d{4,}(?:k)?\b/.test(normalizedLower)) {
    productSignals.push('PRICE_MENTION');
  }
  // RAM/storage/spec mention
  if (/\b\d+\s*(?:GB|TB)\b/i.test(normalizedText)) {
    productSignals.push('SPEC_MENTION');
  }
  // Laptop mention
  if (/\blaptop/i.test(normalizedLower)) {
    productSignals.push('LAPTOP_MENTION');
  }
  // Use case mention
  if (/\b(coding|programming|gaming|student|office|business|editing|rendering)\b/i.test(normalizedLower)) {
    productSignals.push('USE_CASE_MENTION');
  }
  // Product search verbs
  if (/\b(show\s+me|find|search|i\s+want|i\s+need|looking\s+for|give\s+me)\b/i.test(normalizedLower)) {
    productSignals.push('SEARCH_INTENT');
  }

  // ----- Step 4: Compute confidence -----
  const confidence = corrections.length === 0 ? 1.0 :
    Math.max(0.5, 1.0 - (corrections.length * 0.08));

  return {
    originalText,
    normalizedText,
    corrections,
    confidence,
    policySignals,
    productSignals,
  };
};

/**
 * Determines whether a message is primarily a policy query, even after
 * historical product context exists. This prevents stale product requirements
 * from overriding a current-turn policy question.
 *
 * @param {string[]} policySignals - Signals from normalizeCustomerMessage
 * @param {string[]} productSignals - Signals from normalizeCustomerMessage
 * @returns {boolean} True if this is primarily a policy query
 */
export const isPrimaryPolicyQuery = (policySignals = [], productSignals = []) => {
  if (policySignals.length === 0) return false;

  // If there are strong product signals (brand + price, or explicit search intent),
  // then this is NOT primarily a policy query — it's a product query that
  // happens to mention a policy term (e.g. "warranty for HP Pavilion 15")
  const strongProductSignals = ['BRAND_MENTION', 'PRICE_MENTION', 'SEARCH_INTENT'];
  const strongProductCount = productSignals.filter(s => strongProductSignals.includes(s)).length;

  // If 2+ strong product signals, treat as product query
  if (strongProductCount >= 2) return false;

  return true;
};

/**
 * Gets the best policy intent and category from policy signals.
 *
 * @param {string[]} policySignals
 * @returns {{ intent: string, category: string } | null}
 */
export const resolvePolicyIntent = (policySignals = []) => {
  if (policySignals.length === 0) return null;

  // Priority order for policy intents
  const priorityOrder = [
    'DELIVERY_QUERY', 'RETURN_POLICY', 'REFUND_POLICY', 'WARRANTY_QUERY',
    'EXCHANGE_POLICY', 'EMI_QUERY', 'COD_QUERY', 'CANCELLATION_QUERY',
    'DISCOUNT_QUERY', 'SUPPORT_QUERY'
  ];

  for (const intent of priorityOrder) {
    if (policySignals.includes(intent)) {
      const termEntry = Object.values(POLICY_TERMS).find(t => t.intent === intent);
      return {
        intent,
        category: termEntry?.category || 'general'
      };
    }
  }

  return null;
};
