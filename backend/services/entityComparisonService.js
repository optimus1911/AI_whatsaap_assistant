import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { extractActiveProducts } from './pendingActionService.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const fallbackProductsPath = path.resolve(__dirname, '../data/products.json');

let cachedCatalog = null;
const getCatalog = () => {
  if (!cachedCatalog) {
    try {
      cachedCatalog = JSON.parse(fs.readFileSync(fallbackProductsPath, 'utf-8'));
    } catch {
      cachedCatalog = [];
    }
  }
  return cachedCatalog;
};

const BRANDS = ['HP', 'Lenovo', 'Dell', 'ASUS', 'Acer', 'Apple'];
const BRAND_REGEX = /\b(HP|Lenovo|Dell|ASUS|Acer|Apple|MacBook)\b/i;

const PRONOUN_SOURCE_REGEX = /\b(it|this|that|this\s+one|that\s+one|this\s+laptop|the\s+first\s+one|the\s+second\s+one|the\s+current\s+one)\b/i;

// Flexible comparison pattern matchers
const COMPARISON_PATTERNS = [
  // "compare [source] with [target]" / "compare [source] against [target]" / "compare [source] to [target]"
  /compare\s+(.+?)\s+(?:with|against|to|and)\s+(.+)/i,
  // "how does [source] compare (with|to|against) [target]"
  /how\s+does\s+(.+?)\s+compare\s+(?:to|with|against)\s+(.+)/i,
  // "[source] vs [target]" / "[source] versus [target]"
  /(.+?)\s+(?:vs\.?|versus)\s+(.+)/i,
  // "[target] alternative to [source]" / "[target] equivalent to [source]"
  /(?:show\s+me\s+a\s+|find\s+a\s+)?([a-zA-Z0-9\s]+?)\s+(?:alternative|equivalent)\s+to\s+(.+)/i,
  // "compare it / compare this"
  /^compare\s+(?:it|this|that|this\s+one|that\s+one)\s*$/i
];

/**
 * Finds all historical products mentioned across the conversation history.
 */
export const extractAllHistoricalProducts = (conversationHistory = '') => {
  if (!conversationHistory || typeof conversationHistory !== 'string') return [];
  const catalog = getCatalog();
  const found = [];

  for (const item of catalog) {
    const fullName = `${item.brand} ${item.model}`;
    if (
      conversationHistory.toLowerCase().includes(fullName.toLowerCase()) ||
      conversationHistory.toLowerCase().includes(item.model.toLowerCase())
    ) {
      if (!found.includes(fullName)) {
        found.push(fullName);
      }
    }
  }
  return found;
};

/**
 * Finds a catalog product matching a brand and/or model name.
 */
export const findCatalogProduct = (queryStr = '', preferredBrand = null) => {
  if (!queryStr || typeof queryStr !== 'string') return null;
  const catalog = getCatalog();
  let clean = queryStr.trim().toLowerCase().replace(/^the\s+/i, '').trim();

  // 1. Try exact brand + model match
  let matched = catalog.find((c) => `${c.brand} ${c.model}`.toLowerCase() === clean);
  if (matched) return matched;

  // 2. Check if brand is at start of query string
  const brandMatch = clean.match(/^(hp|lenovo|dell|asus|acer|apple|macbook)\b/i);
  let explicitBrand = preferredBrand;
  let modelPart = clean;

  if (brandMatch) {
    explicitBrand = brandMatch[1].toLowerCase() === 'macbook' ? 'Apple' : brandMatch[1];
    modelPart = clean.replace(/^(hp|lenovo|dell|asus|acer|apple|macbook)\s*/i, '').trim();
  }

  // 3. Search catalog with brand + modelPart matching
  if (explicitBrand && modelPart) {
    matched = catalog.find(
      (c) =>
        c.brand.toLowerCase() === explicitBrand.toLowerCase() &&
        (c.model.toLowerCase().includes(modelPart) || modelPart.includes(c.model.toLowerCase()) ||
         c.keywords.some((k) => k.toLowerCase() === modelPart))
    );
    if (matched) return matched;
  }

  // 4. Try model name substring match across all catalog items
  if (modelPart && modelPart.length >= 3) {
    matched = catalog.find(
      (c) =>
        c.model.toLowerCase().includes(modelPart) ||
        modelPart.includes(c.model.toLowerCase().split(/\s+/)[0])
    );
    if (matched) return matched;
  }

  // 5. Try brand filter + model keyword
  if (preferredBrand) {
    const brandProds = catalog.filter((c) => c.brand.toLowerCase() === preferredBrand.toLowerCase());
    matched = brandProds.find((c) => clean.includes(c.model.toLowerCase()));
    if (matched) return matched;
  }

  return null;
};

/**
 * Finds the best comparable product from a target brand given a source product's attributes.
 * Matches closest price tier, similar RAM, and availability.
 */
export const findBestComparableProduct = (sourceProduct, targetBrand) => {
  const catalog = getCatalog();
  const normalizedTargetBrand = targetBrand.toLowerCase() === 'macbook' ? 'Apple' : targetBrand;

  const candidates = catalog.filter(
    (c) => c.brand.toLowerCase() === normalizedTargetBrand.toLowerCase() && c.availability === 'in_stock'
  );

  if (candidates.length === 0) {
    // Fallback to any product of target brand if stock filter fails
    const anyCandidates = catalog.filter((c) => c.brand.toLowerCase() === normalizedTargetBrand.toLowerCase());
    return anyCandidates[0] || null;
  }

  if (!sourceProduct || !sourceProduct.price) {
    return candidates[0];
  }

  // Score candidates: prioritize closest price, then matching RAM
  const sourcePrice = sourceProduct.price;
  const sourceRam = sourceProduct.ram;

  candidates.sort((a, b) => {
    const priceDiffA = Math.abs(a.price - sourcePrice);
    const priceDiffB = Math.abs(b.price - sourcePrice);

    // RAM match bonus (treat exact RAM match as equivalent to ₹5,000 price proximity)
    const ramBonusA = a.ram === sourceRam ? -5000 : 0;
    const ramBonusB = b.ram === sourceRam ? -5000 : 0;

    const scoreA = priceDiffA + ramBonusA;
    const scoreB = priceDiffB + ramBonusB;

    return scoreA - scoreB;
  });

  return candidates[0];
};

/**
 * Parses and resolves explicit comparison requests and cross-brand comparisons.
 *
 * @param {string} currentMessage The customer's message text (e.g. "compare it with dell")
 * @param {Array<string>} activeProducts Currently active products from immediate turn
 * @param {string} conversationHistory Previous turns in the conversation
 * @param {string} lastAssistantMessage The immediately preceding assistant reply
 * @returns {object|null} Structured comparison resolution or null if not a cross-entity comparison
 */
export const resolveEntityComparison = (
  currentMessage = '',
  activeProducts = [],
  conversationHistory = '',
  lastAssistantMessage = ''
) => {
  const text = (currentMessage || '').trim();
  const lower = text.toLowerCase();

  // Quick check if message has comparison cues
  const hasCompareKeyword = /\b(compare|vs\.?|versus|alternative|equivalent|difference\s+between)\b/i.test(lower);
  if (!hasCompareKeyword) return null;

  let rawSource = '';
  let rawTarget = '';
  let isAlternativeQuery = false;

  // 1. Match comparison patterns
  // Pattern A: "show me a Dell alternative to this" / "Dell alternative to this"
  const altMatch = text.match(/(?:show\s+me\s+a\s+|find\s+a\s+)?([a-zA-Z0-9\s]+?)\s+(?:alternative|equivalent)\s+to\s+(.+)/i);
  if (altMatch) {
    rawTarget = altMatch[1].trim();
    rawSource = altMatch[2].trim();
    isAlternativeQuery = true;
  }

  // Pattern B: "compare [source] with [target]" / "compare [source] against [target]" / "compare [source] to [target]"
  if (!rawTarget) {
    const compareMatch = text.match(/compare\s+(.+?)\s+(?:with|against|to|and)\s+(.+)/i);
    if (compareMatch) {
      rawSource = compareMatch[1].trim();
      rawTarget = compareMatch[2].trim();
    }
  }

  // Pattern C: "how does [source] compare to [target]"
  if (!rawTarget) {
    const howMatch = text.match(/how\s+does\s+(.+?)\s+compare\s+(?:to|with|against)\s+(.+)/i);
    if (howMatch) {
      rawSource = howMatch[1].trim();
      rawTarget = howMatch[2].trim();
    }
  }

  // Pattern D: "[source] vs [target]"
  if (!rawTarget) {
    const vsMatch = text.match(/(.+?)\s+(?:vs\.?|versus)\s+(.+)/i);
    if (vsMatch) {
      rawSource = vsMatch[1].trim();
      rawTarget = vsMatch[2].trim();
    }
  }

  // If no structured two-entity match found, return null (handled by standard comparison)
  if (!rawSource && !rawTarget) {
    return null;
  }

  // Clean trailing punctuation
  rawSource = rawSource.replace(/[\?\.\!]+$/, '').trim();
  rawTarget = rawTarget.replace(/[\?\.\!]+$/, '').trim();

  // 2. Resolve Source Entity
  let resolvedSourceProduct = null;
  const isSourcePronoun = PRONOUN_SOURCE_REGEX.test(rawSource) || !rawSource;

  // Resolve source from active products or immediate assistant message
  if (isSourcePronoun) {
    if (activeProducts.length > 0) {
      // If "the second one"
      if (/\b(second|the\s+second)\b/i.test(rawSource) && activeProducts.length >= 2) {
        resolvedSourceProduct = findCatalogProduct(activeProducts[1]);
      } else {
        resolvedSourceProduct = findCatalogProduct(activeProducts[0]);
      }
    }

    // Fallback: extract latest product from lastAssistantMessage
    if (!resolvedSourceProduct && lastAssistantMessage) {
      const extracted = extractActiveProducts(lastAssistantMessage);
      if (extracted.length > 0) {
        resolvedSourceProduct = findCatalogProduct(extracted[0]);
      }
    }
  } else {
    // Explicit source model or brand
    resolvedSourceProduct = findCatalogProduct(rawSource);

    // If source is just a brand (e.g. "Lenovo vs Dell")
    if (!resolvedSourceProduct) {
      const brandMatch = rawSource.match(BRAND_REGEX);
      if (brandMatch) {
        const sourceBrand = brandMatch[1];
        // Check if active products has a product of that brand
        const activeOfBrand = activeProducts.find((p) => p.toLowerCase().includes(sourceBrand.toLowerCase()));
        if (activeOfBrand) {
          resolvedSourceProduct = findCatalogProduct(activeOfBrand);
        } else {
          const catalog = getCatalog();
          resolvedSourceProduct = catalog.find((c) => c.brand.toLowerCase() === sourceBrand.toLowerCase());
        }
      }
    }
  }

  // 3. Resolve Target Entity (Brand vs Specific Product)
  let resolvedTargetProduct = null;
  let explicitTargetBrand = null;

  // Check if target is a specific product first
  resolvedTargetProduct = findCatalogProduct(rawTarget);

  if (!resolvedTargetProduct) {
    const brandMatch = rawTarget.match(BRAND_REGEX);
    if (brandMatch) {
      explicitTargetBrand = brandMatch[1];
      if (explicitTargetBrand.toLowerCase() === 'macbook') explicitTargetBrand = 'Apple';

      // Find best comparable product from target brand
      resolvedTargetProduct = findBestComparableProduct(resolvedSourceProduct, explicitTargetBrand);
    }
  } else {
    explicitTargetBrand = resolvedTargetProduct.brand;
  }

  if (!resolvedSourceProduct || !resolvedTargetProduct) {
    return null;
  }

  // 4. Compute Historical Products Ignored
  const allHistorical = extractAllHistoricalProducts(conversationHistory);
  const sourceFullName = `${resolvedSourceProduct.brand} ${resolvedSourceProduct.model}`;
  const targetFullName = `${resolvedTargetProduct.brand} ${resolvedTargetProduct.model}`;

  const historicalProductsIgnored = allHistorical.filter(
    (p) => p.toLowerCase() !== sourceFullName.toLowerCase() && p.toLowerCase() !== targetFullName.toLowerCase()
  );

  // 5. Output structured traces
  console.log(`[COMPARE-TRACE] currentMessage="${currentMessage}"`);
  console.log(`[COMPARE-TRACE] detectedIntent=PRODUCT_COMPARISON`);
  console.log(`[COMPARE-TRACE] resolvedSourceEntity=${JSON.stringify({ name: sourceFullName, price: resolvedSourceProduct.price, ram: resolvedSourceProduct.ram })}`);
  console.log(`[COMPARE-TRACE] explicitTargetBrand="${explicitTargetBrand || resolvedTargetProduct.brand}"`);
  console.log(`[COMPARE-TRACE] previousAssistantProducts=${JSON.stringify(activeProducts.length > 0 ? activeProducts : [sourceFullName])}`);
  console.log(`[COMPARE-TRACE] historicalProductsIgnored=${JSON.stringify(historicalProductsIgnored)}`);
  console.log(`[COMPARE-TRACE] comparisonCandidateQuery=${JSON.stringify({ brand: explicitTargetBrand || resolvedTargetProduct.brand, targetPrice: resolvedSourceProduct.price, targetRam: resolvedSourceProduct.ram })}`);
  console.log(`[COMPARE-TRACE] selectedComparisonProduct="${targetFullName}"`);
  console.log(`[COMPARE-TRACE] responseSource=PRODUCT_COMPARISON`);

  return {
    isEntityComparison: true,
    sourceProduct: resolvedSourceProduct,
    targetProduct: resolvedTargetProduct,
    explicitTargetBrand,
    comparedProducts: [resolvedSourceProduct, resolvedTargetProduct],
    comparedModelNames: [sourceFullName, targetFullName],
    historicalProductsIgnored
  };
};
