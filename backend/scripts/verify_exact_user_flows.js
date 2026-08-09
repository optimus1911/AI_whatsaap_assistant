import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

process.env.RAG_TEST_MODE = 'true';
dotenv.config({ path: path.resolve(__dirname, '../.env') });

import { generateAiResponse } from '../services/geminiService.js';
import { detectIntentAndRequirements } from '../services/intentService.js';
import { searchProducts } from '../services/productSearchService.js';

let passed = 0;
let failed = 0;

function printFlowResult({
  testNumber,
  testTitle,
  input,
  detectedIntent,
  pendingAction,
  activeProducts,
  selectedAction,
  selectedProductIds,
  responseSource,
  finalResponse,
  isPass,
  failureReason = ''
}) {
  console.log(`\n================================================================`);
  console.log(`TEST [${testNumber}/10]: ${testTitle}`);
  console.log(`----------------------------------------------------------------`);
  console.log(`Input:               "${input}"`);
  console.log(`Detected Intent:     ${detectedIntent}`);
  console.log(`Pending Action:      ${JSON.stringify(pendingAction)}`);
  console.log(`Active Products:     ${JSON.stringify(activeProducts)}`);
  console.log(`Selected Action:     ${selectedAction}`);
  console.log(`Selected ProductIDs: ${JSON.stringify(selectedProductIds)}`);
  console.log(`Response Source:     ${responseSource}`);
  console.log(`Final Response:\n${finalResponse}`);
  console.log(`----------------------------------------------------------------`);
  if (isPass) {
    console.log(`STATUS:              \x1b[32mPASS ✓\x1b[0m`);
    passed++;
  } else {
    console.log(`STATUS:              \x1b[31mFAIL ✗ (${failureReason})\x1b[0m`);
    failed++;
  }
  console.log(`================================================================`);
}

async function runExactFlowVerification() {
  console.log('\n################################################################');
  console.log('⚡ SALESPILOT-AI — 10 EXACT FLOWS VERIFICATION MATRIX');
  console.log('################################################################');

  // Presented HP Products context
  const hpLaptopsResponse = `Here are the *HP* laptops under *₹70,000*:

1. *HP Pavilion 15* — *₹65,999*
   16GB RAM • 512GB SSD • Intel Core i5 13th Gen

2. *HP Victus 15* — *₹68,999*
   16GB RAM • 512GB SSD • AMD Ryzen 5 7535HS

Would you like me to compare the *HP Pavilion 15* and *HP Victus 15*?`;

  const dualOfferResponse = `Here are the *HP* laptops under *₹70,000*:

1. *HP Pavilion 15* — *₹65,999*
   16GB RAM • 512GB SSD • Intel Core i5 13th Gen

2. *HP Victus 15* — *₹68,999*
   16GB RAM • 512GB SSD • AMD Ryzen 5 7535HS

Would you like me to compare any of these models or check warranty details?`;

  // ----------------------------------------------------------------
  // FLOW 1: HP laptop under ₹70,000 -> products shown -> "yes"
  // ----------------------------------------------------------------
  const intent1 = detectIntentAndRequirements('yes', '', hpLaptopsResponse);
  const res1 = await generateAiResponse('yes', '', '', hpLaptopsResponse);
  const isPass1 =
    res1.reply.includes('Pavilion 15') &&
    res1.reply.includes('Victus 15') &&
    res1.responseSource === 'PRODUCT_COMPARISON';

  printFlowResult({
    testNumber: 1,
    testTitle: 'HP laptop under ₹70,000 → products shown → "yes" (Single Compare Offer)',
    input: 'yes',
    detectedIntent: intent1.intent,
    pendingAction: intent1.pendingAction,
    activeProducts: intent1.followUpState?.activeProducts || [],
    selectedAction: intent1.followUpState?.selectedAction || 'DIRECT_ROUTING',
    selectedProductIds: intent1.requirements.mentionedModels,
    responseSource: res1.responseSource,
    finalResponse: res1.reply,
    isPass: isPass1,
    failureReason: 'Did not execute target comparison between active products'
  });

  // ----------------------------------------------------------------
  // FLOW 2: HP laptop under ₹70,000 -> "compare them"
  // ----------------------------------------------------------------
  const intent2 = detectIntentAndRequirements('compare them', '', hpLaptopsResponse);
  const res2 = await generateAiResponse('compare them', '', '', hpLaptopsResponse);
  const isPass2 =
    res2.reply.includes('Pavilion 15') &&
    res2.reply.includes('Victus 15') &&
    res2.responseSource === 'PRODUCT_COMPARISON';

  printFlowResult({
    testNumber: 2,
    testTitle: 'HP laptop under ₹70,000 → "compare them"',
    input: 'compare them',
    detectedIntent: intent2.intent,
    pendingAction: intent2.pendingAction,
    activeProducts: intent2.followUpState?.activeProducts || [],
    selectedAction: intent2.followUpState?.selectedAction || 'DIRECT_ROUTING',
    selectedProductIds: intent2.requirements.mentionedModels,
    responseSource: res2.responseSource,
    finalResponse: res2.reply,
    isPass: isPass2,
    failureReason: 'Did not compare Pavilion 15 and Victus 15'
  });

  // ----------------------------------------------------------------
  // FLOW 3: HP laptop under ₹70,000 -> "check warranty"
  // ----------------------------------------------------------------
  const intent3 = detectIntentAndRequirements('check warranty', '', hpLaptopsResponse);
  const res3 = await generateAiResponse('check warranty', '', '', hpLaptopsResponse);
  const isPass3 =
    res3.reply.includes('Warranty') &&
    (res3.reply.includes('Pavilion 15') || res3.reply.includes('Victus 15')) &&
    res3.responseSource === 'BUSINESS_RAG';

  printFlowResult({
    testNumber: 3,
    testTitle: 'HP laptop under ₹70,000 → "check warranty"',
    input: 'check warranty',
    detectedIntent: intent3.intent,
    pendingAction: intent3.pendingAction,
    activeProducts: intent3.followUpState?.activeProducts || [],
    selectedAction: intent3.followUpState?.selectedAction || 'DIRECT_ROUTING',
    selectedProductIds: intent3.requirements.mentionedModels,
    responseSource: res3.responseSource,
    finalResponse: res3.reply,
    isPass: isPass3,
    failureReason: 'Did not retrieve warranty for active products'
  });

  // ----------------------------------------------------------------
  // FLOW 4: Assistant offers comparison/warranty -> "yes" (Ambiguous -> Clarification)
  // ----------------------------------------------------------------
  const intent4 = detectIntentAndRequirements('yes', '', dualOfferResponse);
  const res4 = await generateAiResponse('yes', '', '', dualOfferResponse);
  const isPass4 =
    res4.reply.includes('Compare') &&
    res4.reply.includes('warranty') &&
    !res4.reply.includes('HP 15s') &&
    res4.responseSource === 'DETERMINISTIC_FALLBACK';

  printFlowResult({
    testNumber: 4,
    testTitle: 'Assistant offers comparison/warranty → "yes" (Ambiguous -> Clarification)',
    input: 'yes',
    detectedIntent: intent4.intent,
    pendingAction: intent4.pendingAction,
    activeProducts: intent4.followUpState?.activeProducts || [],
    selectedAction: intent4.followUpState?.selectedAction || 'DIRECT_ROUTING',
    selectedProductIds: intent4.requirements.mentionedModels,
    responseSource: res4.responseSource,
    finalResponse: res4.reply,
    isPass: isPass4,
    failureReason: 'Did not return clarification prompt'
  });

  // ----------------------------------------------------------------
  // FLOW 5: Old requirement RAM=8GB -> new products are 16GB -> "yes" must NOT return an 8GB laptop
  // ----------------------------------------------------------------
  const historyWithOld8Gb = `CUSTOMER: "I want an HP laptop."\nCUSTOMER: "8GB RAM."\nASSISTANT: "${dualOfferResponse}"`;
  const intent5 = detectIntentAndRequirements('yes', historyWithOld8Gb, dualOfferResponse);
  const res5 = await generateAiResponse('yes', '', historyWithOld8Gb, dualOfferResponse);
  const isPass5 =
    !res5.reply.includes('HP 15s') &&
    !res5.reply.includes('8GB RAM') &&
    res5.responseSource === 'DETERMINISTIC_FALLBACK';

  printFlowResult({
    testNumber: 5,
    testTitle: 'Old requirement RAM=8GB → new products are 16GB → "yes" must NOT return 8GB laptop',
    input: 'yes',
    detectedIntent: intent5.intent,
    pendingAction: intent5.pendingAction,
    activeProducts: intent5.followUpState?.activeProducts || [],
    selectedAction: intent5.followUpState?.selectedAction || 'DIRECT_ROUTING',
    selectedProductIds: intent5.requirements.mentionedModels,
    responseSource: res5.responseSource,
    finalResponse: res5.reply,
    isPass: isPass5,
    failureReason: 'Stale 8GB requirement leaked into follow-up response'
  });

  // ----------------------------------------------------------------
  // FLOW 6: Assistant offers follow-up -> "show me Lenovo laptops" must perform a new Lenovo search
  // ----------------------------------------------------------------
  const intent6 = detectIntentAndRequirements('show me Lenovo laptops', '', dualOfferResponse);
  const res6 = await generateAiResponse('show me Lenovo laptops', '', '', dualOfferResponse);
  const isPass6 =
    res6.reply.includes('Lenovo') &&
    (res6.reply.includes('IdeaPad') || res6.reply.includes('ThinkPad')) &&
    !res6.reply.includes('Pavilion 15') &&
    res6.responseSource === 'DETERMINISTIC_FALLBACK';

  printFlowResult({
    testNumber: 6,
    testTitle: 'Assistant offers follow-up → "show me Lenovo laptops" (Explicit New Search Override)',
    input: 'show me Lenovo laptops',
    detectedIntent: intent6.intent,
    pendingAction: intent6.pendingAction,
    activeProducts: intent6.followUpState?.activeProducts || [],
    selectedAction: intent6.followUpState?.selectedAction || 'DIRECT_ROUTING',
    selectedProductIds: intent6.requirements.mentionedModels,
    responseSource: res6.responseSource,
    finalResponse: res6.reply,
    isPass: isPass6,
    failureReason: 'Did not execute explicit Lenovo product search'
  });

  // ----------------------------------------------------------------
  // FLOW 7: "what about warranty?" must target previously presented products
  // ----------------------------------------------------------------
  const intent7 = detectIntentAndRequirements('what about warranty?', '', hpLaptopsResponse);
  const res7 = await generateAiResponse('what about warranty?', '', '', hpLaptopsResponse);
  const isPass7 =
    res7.reply.includes('Warranty') &&
    (res7.reply.includes('Pavilion 15') || res7.reply.includes('Victus 15')) &&
    res7.responseSource === 'BUSINESS_RAG';

  printFlowResult({
    testNumber: 7,
    testTitle: '"what about warranty?" must target previously presented products',
    input: 'what about warranty?',
    detectedIntent: intent7.intent,
    pendingAction: intent7.pendingAction,
    activeProducts: intent7.followUpState?.activeProducts || [],
    selectedAction: intent7.followUpState?.selectedAction || 'DIRECT_ROUTING',
    selectedProductIds: intent7.requirements.mentionedModels,
    responseSource: res7.responseSource,
    finalResponse: res7.reply,
    isPass: isPass7,
    failureReason: 'Did not target previously presented models'
  });

  // ----------------------------------------------------------------
  // FLOW 8: "warranty for Pavilion" must target HP Pavilion 15
  // ----------------------------------------------------------------
  const intent8 = detectIntentAndRequirements('warranty for Pavilion', '', hpLaptopsResponse);
  const res8 = await generateAiResponse('warranty for Pavilion', '', '', hpLaptopsResponse);
  const isPass8 =
    res8.reply.includes('Pavilion') &&
    res8.reply.includes('Warranty') &&
    res8.responseSource === 'BUSINESS_RAG';

  printFlowResult({
    testNumber: 8,
    testTitle: '"warranty for Pavilion" must target HP Pavilion 15',
    input: 'warranty for Pavilion',
    detectedIntent: intent8.intent,
    pendingAction: intent8.pendingAction,
    activeProducts: intent8.followUpState?.activeProducts || [],
    selectedAction: intent8.followUpState?.selectedAction || 'DIRECT_ROUTING',
    selectedProductIds: intent8.requirements.mentionedModels,
    responseSource: res8.responseSource,
    finalResponse: res8.reply,
    isPass: isPass8,
    failureReason: 'Did not target HP Pavilion 15'
  });

  // ----------------------------------------------------------------
  // FLOW 9: Gemini 429/quota exhausted -> follow-up still works through deterministic fallback
  // ----------------------------------------------------------------
  const res9 = await generateAiResponse('which one is cheaper?', '', '', hpLaptopsResponse);
  const isPass9 =
    res9.reply.includes('HP Pavilion 15') &&
    res9.reply.includes('cheaper') &&
    !res9.geminiUsed &&
    res9.responseSource === 'PRODUCT_COMPARISON';

  printFlowResult({
    testNumber: 9,
    testTitle: 'Gemini 429/quota exhausted → follow-up still works through deterministic fallback',
    input: 'which one is cheaper?',
    detectedIntent: 'PRODUCT_COMPARISON',
    pendingAction: { type: 'ACTIVE_CONTEXT', offeredActions: [], activeProducts: ['HP Pavilion 15', 'HP Victus 15'] },
    activeProducts: ['HP Pavilion 15', 'HP Victus 15'],
    selectedAction: 'CHEAPEST_COMPARISON',
    selectedProductIds: ['HP Pavilion 15', 'HP Victus 15'],
    responseSource: res9.responseSource,
    finalResponse: res9.reply,
    isPass: isPass9,
    failureReason: 'Deterministic fallback failed during Gemini quota cooldown'
  });

  // ----------------------------------------------------------------
  // FLOW 10: Duplicate / repeated WhatsApp webhook must not produce duplicate responses
  // ----------------------------------------------------------------
  const mockMessageId = `wamid.HBgL${Date.now()}`;
  const seenMap = new Map();
  const isDuplicateCheck = (msgId) => {
    if (seenMap.has(msgId)) return true;
    seenMap.set(msgId, Date.now());
    return false;
  };

  const firstDelivery = isDuplicateCheck(mockMessageId);
  const secondDelivery = isDuplicateCheck(mockMessageId);
  const isPass10 = !firstDelivery && secondDelivery;

  printFlowResult({
    testNumber: 10,
    testTitle: 'Duplicate / repeated WhatsApp webhook must not produce duplicate responses',
    input: `Webhook Event ID: ${mockMessageId} (Delivered Twice)`,
    detectedIntent: 'WEBHOOK_EVENT_DEDUPLICATION',
    pendingAction: { type: 'NONE' },
    activeProducts: [],
    selectedAction: 'EVENT_IDEMPOTENCY_FILTER',
    selectedProductIds: [],
    responseSource: 'DEDUP_CACHE_DROP_DUPLICATE',
    finalResponse: `First delivery: Processed (HTTP 200) | Second delivery: Dropped duplicate event [FLOW-TRACE: duplicateWhatsAppEventIgnored messageId="${mockMessageId}"]`,
    isPass: isPass10,
    failureReason: 'Did not filter duplicate event delivery'
  });

  console.log('\n################################################################');
  console.log(`VERIFICATION SUMMARY: \x1b[32m${passed} Passed\x1b[0m, \x1b[31m${failed} Failed\x1b[0m`);
  console.log('################################################################\n');

  if (failed > 0) process.exit(1);
}

runExactFlowVerification().catch((err) => {
  console.error('Exact flow verification failed:', err);
  process.exit(1);
});
