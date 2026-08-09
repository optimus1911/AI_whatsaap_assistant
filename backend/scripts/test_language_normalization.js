import { normalizeCustomerMessage, isPrimaryPolicyQuery, resolvePolicyIntent } from '../services/queryNormalizationService.js';
import { detectIntentAndRequirements } from '../services/intentService.js';
import { executeRagRetrieval } from '../services/ragService.js';

let passed = 0;
let failed = 0;

function assert(condition, label) {
  if (condition) {
    console.log(`  ✓ PASS: ${label}`);
    passed++;
  } else {
    console.log(`  ✗ FAIL: ${label}`);
    failed++;
  }
}

console.log('================================================================');
console.log('🧪 LANGUAGE NORMALIZATION & TYPO TOLERANCE TESTS');
console.log('================================================================\n');


console.log('--- Section 1: Typo Correction ---');

{
  const r = normalizeCustomerMessage('what si ddelivery time');
  assert(r.normalizedText.includes('what is delivery time'), `"what si ddelivery time" → "${r.normalizedText}"`);
  assert(r.corrections.length >= 2, `Corrections detected: ${JSON.stringify(r.corrections)}`);
}

{
  const r = normalizeCustomerMessage('whta is delivery time');
  assert(r.normalizedText.includes('what') && r.normalizedText.includes('delivery'), `"whta is delivery time" → "${r.normalizedText}"`);
}

{
  const r = normalizeCustomerMessage('delivary time?');
  assert(r.normalizedText.includes('delivery'), `"delivary time?" → "${r.normalizedText}"`);
}

{
  const r = normalizeCustomerMessage('retun policy');
  assert(r.normalizedText.includes('return'), `"retun policy" → "${r.normalizedText}"`);
}

{
  const r = normalizeCustomerMessage('warrnty?');
  assert(r.normalizedText.includes('warranty'), `"warrnty?" → "${r.normalizedText}"`);
}

{
  const r = normalizeCustomerMessage('refnd time');
  assert(r.normalizedText.includes('refund'), `"refnd time" → "${r.normalizedText}"`);
}

{
  const r = normalizeCustomerMessage('exchnage policy');
  assert(r.normalizedText.includes('exchange'), `"exchnage policy" → "${r.normalizedText}"`);
}

{
  const r = normalizeCustomerMessage('emi avilable');
  assert(r.normalizedText.includes('emi') && r.normalizedText.includes('available'), `"emi avilable" → "${r.normalizedText}"`);
}

{
  const r = normalizeCustomerMessage('cash on delivary');
  assert(r.normalizedText.includes('delivery'), `"cash on delivary" → "${r.normalizedText}"`);
}

console.log('\n--- Section 2: Policy Signal Detection ---');

{
  const r = normalizeCustomerMessage('what si ddelivery time');
  assert(r.policySignals.includes('DELIVERY_QUERY'), `"what si ddelivery time" → signals: ${JSON.stringify(r.policySignals)}`);
  assert(r.productSignals.length === 0, `No product signals: ${JSON.stringify(r.productSignals)}`);
}

{
  const r = normalizeCustomerMessage('how long does delivery take');
  assert(r.policySignals.includes('DELIVERY_QUERY'), `"how long does delivery take" → DELIVERY_QUERY`);
}

{
  const r = normalizeCustomerMessage('retun policy');
  assert(r.policySignals.includes('RETURN_POLICY'), `"retun policy" → RETURN_POLICY`);
}

{
  const r = normalizeCustomerMessage('warrnty?');
  assert(r.policySignals.includes('WARRANTY_QUERY'), `"warrnty?" → WARRANTY_QUERY`);
}

{
  const r = normalizeCustomerMessage('refnd time');
  assert(r.policySignals.includes('REFUND_POLICY'), `"refnd time" → REFUND_POLICY`);
}

{
  const r = normalizeCustomerMessage('exchnage policy');
  assert(r.policySignals.includes('EXCHANGE_POLICY'), `"exchnage policy" → EXCHANGE_POLICY`);
}

{
  const r = normalizeCustomerMessage('emi avilable');
  assert(r.policySignals.includes('EMI_QUERY'), `"emi avilable" → EMI_QUERY`);
}

{
  const r = normalizeCustomerMessage('cash on delivary');
  assert(r.policySignals.includes('COD_QUERY'), `"cash on delivary" → COD_QUERY`);
}


console.log('\n--- Section 3: Product Search Preservation ---');

{
  const r = normalizeCustomerMessage('hp lapotp under 70000');
  assert(r.normalizedText.includes('laptop'), `"hp lapotp under 70000" → "${r.normalizedText}"`);
  assert(r.productSignals.includes('BRAND_MENTION'), `Brand signal preserved`);
  assert(r.productSignals.includes('PRICE_MENTION'), `Price signal preserved`);
  assert(r.policySignals.length === 0, `No policy signals for product query`);
}

{
  const r = normalizeCustomerMessage('dell lapotp under 50000');
  assert(r.normalizedText.includes('laptop'), `"dell lapotp under 50000" → "${r.normalizedText}"`);
  assert(r.productSignals.includes('BRAND_MENTION'), `Brand signal preserved for Dell`);
}

{
  const r = normalizeCustomerMessage('show me lenovo laptops');
  assert(r.productSignals.includes('BRAND_MENTION'), `Brand signal for "show me lenovo laptops"`);
  assert(r.productSignals.includes('SEARCH_INTENT'), `Search intent for "show me lenovo laptops"`);
}

{
  const r = normalizeCustomerMessage('hp 16gb laptop');
  assert(r.productSignals.includes('BRAND_MENTION'), `HP brand preserved`);
  assert(r.productSignals.includes('SPEC_MENTION'), `16GB spec preserved`);
}


console.log('\n--- Section 4: Hinglish Tolerance ---');

{
  const r = normalizeCustomerMessage('delivery kitne din me hogi');
  assert(r.policySignals.includes('DELIVERY_QUERY'), `"delivery kitne din me hogi" → DELIVERY_QUERY`);
}

{
  const r = normalizeCustomerMessage('laptop kab milega');
  assert(r.policySignals.includes('DELIVERY_QUERY'), `"laptop kab milega" → DELIVERY_QUERY`);
}

{
  const r = normalizeCustomerMessage('warranty kitni hai');
  assert(r.policySignals.includes('WARRANTY_QUERY'), `"warranty kitni hai" → WARRANTY_QUERY`);
}

{
  const r = normalizeCustomerMessage('emi hai kya');
  assert(r.policySignals.includes('EMI_QUERY'), `"emi hai kya" → EMI_QUERY`);
}

{
  const r = normalizeCustomerMessage('cod available hai?');
  assert(r.policySignals.includes('COD_QUERY'), `"cod available hai?" → COD_QUERY`);
}


console.log('\n--- Section 5: Intent Detection Integration ---');

{
  const r = detectIntentAndRequirements('what si ddelivery time', '', '');
  assert(r.intent !== 'PRODUCT_SEARCH', `"what si ddelivery time" → intent=${r.intent} (not PRODUCT_SEARCH)`);
  assert(r.isPolicyQuery === true, `isPolicyQuery=true`);
  assert(r.requirements.brand === null, `No brand leaked from history`);
  assert(r.requirements.maxPrice === null, `No price leaked from history`);
}

{
  const r = detectIntentAndRequirements('whta is delivery time', '', '');
  assert(r.intent !== 'PRODUCT_SEARCH', `"whta is delivery time" → intent=${r.intent} (not PRODUCT_SEARCH)`);
}

{
  const r = detectIntentAndRequirements('delivary time?', '', '');
  assert(r.intent !== 'PRODUCT_SEARCH', `"delivary time?" → intent=${r.intent} (not PRODUCT_SEARCH)`);
}

{
  const r = detectIntentAndRequirements('retun policy', '', '');
  assert(r.intent === 'RETURN_POLICY', `"retun policy" → intent=RETURN_POLICY (got ${r.intent})`);
}

{
  const r = detectIntentAndRequirements('warrnty?', '', '');
  assert(r.intent === 'WARRANTY_QUERY', `"warrnty?" → intent=WARRANTY_QUERY (got ${r.intent})`);
}

{
  const r = detectIntentAndRequirements('refnd time', '', '');
  assert(r.intent === 'REFUND_POLICY', `"refnd time" → intent=REFUND_POLICY (got ${r.intent})`);
}

{
  const r = detectIntentAndRequirements('exchnge policy', '', '');
  assert(r.intent === 'EXCHANGE_POLICY', `"exchnge policy" → intent=EXCHANGE_POLICY (got ${r.intent})`);
}

{
  const r = detectIntentAndRequirements('emi avilable', '', '');
  assert(r.intent !== 'PRODUCT_SEARCH', `"emi avilable" → intent=${r.intent} (not PRODUCT_SEARCH)`);
}

{
  const r = detectIntentAndRequirements('cash on delivary', '', '');
  assert(r.intent !== 'PRODUCT_SEARCH', `"cash on delivary" → intent=${r.intent} (not PRODUCT_SEARCH)`);
}


console.log('\n--- Section 6: Product Search with Typos Preserves Requirements ---');

{
  const r = detectIntentAndRequirements('hp lapotp under 70000', '', '');
  assert(r.intent === 'PRODUCT_SEARCH', `"hp lapotp under 70000" → PRODUCT_SEARCH`);
  assert(r.requirements.brand && r.requirements.brand.toLowerCase() === 'hp', `brand=HP (got ${r.requirements.brand})`);
  assert(r.requirements.maxPrice === 70000, `maxPrice=70000 (got ${r.requirements.maxPrice})`);
}

{
  const r = detectIntentAndRequirements('dell lapotp under 50000', '', '');
  assert(r.intent === 'PRODUCT_SEARCH', `"dell lapotp under 50000" → PRODUCT_SEARCH`);
  assert(r.requirements.brand && r.requirements.brand.toLowerCase() === 'dell', `brand=Dell (got ${r.requirements.brand})`);
  assert(r.requirements.maxPrice === 50000, `maxPrice=50000 (got ${r.requirements.maxPrice})`);
}

{
  const r = detectIntentAndRequirements('show me lenovo laptops', '', '');
  assert(r.intent === 'PRODUCT_SEARCH', `"show me lenovo laptops" → PRODUCT_SEARCH`);
  assert(r.requirements.brand && r.requirements.brand.toLowerCase() === 'lenovo', `brand=Lenovo (got ${r.requirements.brand})`);
}

console.log('\n--- Section 7: Policy Query Isolation from History ---');

{
  const history = 'CUSTOMER: "lenovo under 50000"\nASSISTANT: "Here is the Lenovo IdeaPad Slim 3..."';
  const r = detectIntentAndRequirements('what si ddelivery time', history, '');
  assert(r.intent !== 'PRODUCT_SEARCH', `With Lenovo history: "what si ddelivery time" → intent=${r.intent} (not PRODUCT_SEARCH)`);
  assert(r.requirements.brand === null, `brand=null (not Lenovo) (got ${r.requirements.brand})`);
  assert(r.requirements.maxPrice === null, `maxPrice=null (not 50000) (got ${r.requirements.maxPrice})`);
  assert(r.isPolicyQuery === true, `isPolicyQuery=true`);
}


console.log('\n--- Section 8: Exact Production Regression ---');

{
 
  const history = [
    'CUSTOMER: "lenovo under 50000"',
    'ASSISTANT: "Here are the lenovo laptops under ₹50,000:\n\n1. Lenovo IdeaPad Slim 3 — ₹38,999\n\nWould you like me to check warranty details for the Lenovo IdeaPad Slim 3?"',
    'CUSTOMER: "yes"',
    'ASSISTANT: "The Lenovo IdeaPad Slim 3 includes a 1-Year Official Manufacturer Brand Warranty..."'
  ].join('\n');

  const lastAssistant = 'The Lenovo IdeaPad Slim 3 includes a 1-Year Official Manufacturer Brand Warranty covering internal hardware defects.';

  const r = detectIntentAndRequirements('what si ddelivery time', history, lastAssistant);

  assert(r.intent !== 'PRODUCT_SEARCH', `Production scenario: intent=${r.intent} (NOT PRODUCT_SEARCH)`);
  assert(r.isPolicyQuery === true, `Production scenario: isPolicyQuery=true`);
  assert(r.requirements.brand === null, `Production scenario: brand=null (got ${r.requirements.brand})`);
  assert(r.requirements.maxPrice === null, `Production scenario: maxPrice=null (got ${r.requirements.maxPrice})`);
}

{
  const history = 'CUSTOMER: "lenovo under 50000"\nASSISTANT: "Lenovo IdeaPad Slim 3"';
  const lastAssistant = 'The Lenovo IdeaPad Slim 3 includes a 1-Year Official Manufacturer Brand Warranty.';
  const ragResult = await executeRagRetrieval('what si ddelivery time', history, lastAssistant);

  assert(ragResult.intent !== 'PRODUCT_SEARCH', `RAG pipeline: intent=${ragResult.intent} (NOT PRODUCT_SEARCH)`);
  assert(ragResult.rawKnowledge.length > 0, `RAG pipeline: business knowledge retrieved (${ragResult.rawKnowledge.length} items)`);
  if (ragResult.rawKnowledge.length > 0) {
    const titles = ragResult.rawKnowledge.map(k => k.title).join(', ');
    assert(titles.toLowerCase().includes('shipping') || titles.toLowerCase().includes('delivery'),
      `RAG pipeline: knowledge includes shipping/delivery (titles: ${titles})`);
  }
  assert(ragResult.rawProducts.length === 0, `RAG pipeline: 0 products (not Lenovo/Dell) (got ${ragResult.rawProducts.length})`);
}


console.log('\n--- Section 9: Natural Language Variations ---');

const deliveryVariations = [
  'what delivery time',
  "what's delivery time",
  'delivery time?',
  'how much time delivery',
  'how long delivery',
  'when delivery',
  'when will it arrive',
  'when can i get it',
  'how many days delivery',
];

for (const msg of deliveryVariations) {
  const r = normalizeCustomerMessage(msg);
  assert(r.policySignals.includes('DELIVERY_QUERY'), `"${msg}" → DELIVERY_QUERY (signals: ${JSON.stringify(r.policySignals)})`);
}

const returnVariations = [
  'return possible?',
  'can return?',
  'what return policy',
  'how many days return',
  'return time',
];

for (const msg of returnVariations) {
  const r = normalizeCustomerMessage(msg);
  assert(r.policySignals.includes('RETURN_POLICY'), `"${msg}" → RETURN_POLICY (signals: ${JSON.stringify(r.policySignals)})`);
}

const warrantyVariations = [
  'warranty?',
  'what warranty',
  'warranty for this',
  'how long warranty',
  'does this have warranty',
];

for (const msg of warrantyVariations) {
  const r = normalizeCustomerMessage(msg);
  assert(r.policySignals.includes('WARRANTY_QUERY'), `"${msg}" → WARRANTY_QUERY (signals: ${JSON.stringify(r.policySignals)})`);
}


console.log(`\n----------------------------------------------------------------`);
console.log(`Language Normalization Summary: ${passed} Passed, ${failed} Failed`);
console.log(`----------------------------------------------------------------\n`);

process.exit(failed > 0 ? 1 : 0);
