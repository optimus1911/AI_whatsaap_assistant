import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

process.env.RAG_TEST_MODE = 'true';
dotenv.config({ path: path.resolve(__dirname, '../.env') });

import { generateAiResponse } from '../services/geminiService.js';
import { detectIntentAndRequirements } from '../services/intentService.js';

let passed = 0;
let failed = 0;

function assert(condition, testName, details = '') {
  if (condition) {
    console.log(`  \x1b[32m✓ PASS\x1b[0m: ${testName} ${details ? `\x1b[90m(${details})\x1b[0m` : ''}`);
    passed++;
  } else {
    console.error(`  \x1b[31m✗ FAIL\x1b[0m: ${testName} ${details ? `\x1b[90m(${details})\x1b[0m` : ''}`);
    failed++;
  }
}

async function runFollowUpActionSuite() {
  console.log('\n================================================================');
  console.log('🎯 RUNNING CONFIRMATION & FOLLOW-UP ACTION TEST MATRIX (10 TESTS)');
  console.log('⚡ (Verifying Pending Action State & Stale Context Prevention)');
  console.log('================================================================\n');

  const assistantPresentedProducts = `Here are the HP laptops under ₹70,000:

1. HP Pavilion 15 — ₹65,999
   16GB RAM • 512GB SSD • Intel Core i5 13th Gen

2. HP Victus 15 — ₹68,999
   16GB RAM • 512GB SSD • AMD Ryzen 5 7535HS`;

  // ----------------------------------------------------------------
  // TEST 1: Single Warranty Offer
  // ----------------------------------------------------------------
  console.log('👉 [1/10] Test 1: Single warranty offer + "yes"');
  const offer1 = 'Would you like me to check the warranty for HP Pavilion 15?';
  const res1 = await generateAiResponse('yes', '', '', offer1);
  const isWarranty1 = res1.reply.includes('Warranty') && res1.reply.includes('Pavilion 15');
  const hasNoProductSearch1 = !res1.reply.includes('HP 15s');
  assert(
    isWarranty1 && hasNoProductSearch1 && res1.responseSource === 'BUSINESS_RAG',
    'Test 1: Single warranty offer resolves to WARRANTY_QUERY for Pavilion 15',
    `Source: ${res1.responseSource} | Reply: "${res1.reply.substring(0, 60)}..."`
  );

  // ----------------------------------------------------------------
  // TEST 2: Single Comparison Offer
  // ----------------------------------------------------------------
  console.log('\n👉 [2/10] Test 2: Single comparison offer + "yes"');
  const offer2 = 'Would you like me to compare the HP Pavilion 15 and HP Victus 15?';
  const res2 = await generateAiResponse('yes', '', '', offer2);
  const isComparison2 = res2.reply.includes('Pavilion 15') && res2.reply.includes('Victus 15') && res2.reply.includes('Price:');
  assert(
    isComparison2 && (res2.responseSource === 'PRODUCT_COMPARISON' || res2.responseSource === 'GEMINI_RAG'),
    'Test 2: Single comparison offer resolves to PRODUCT_COMPARISON between target models',
    `Source: ${res2.responseSource}`
  );

  // ----------------------------------------------------------------
  // TEST 3: Ambiguous Multiple Offers ("compare or check warranty")
  // ----------------------------------------------------------------
  console.log('\n👉 [3/10] Test 3: Ambiguous multiple offers + "yes" -> Clarification');
  const offer3 = `${assistantPresentedProducts}\n\nWould you like me to compare any of these models or check warranty details?`;
  const res3 = await generateAiResponse('yes', '', '', offer3);
  const isClarification3 = res3.reply.includes('Compare') && res3.reply.includes('warranty');
  const hasNoHp15s3 = !res3.reply.includes('HP 15s') && !res3.reply.includes('8GB RAM');
  assert(
    isClarification3 && hasNoHp15s3 && res3.responseSource === 'DETERMINISTIC_FALLBACK',
    'Test 3: Ambiguous "yes" returns clarification without triggering broad product search',
    `Reply: "${res3.reply.replace(/\n/g, ' ')}"`
  );

  // ----------------------------------------------------------------
  // TEST 4: Explicit "compare them"
  // ----------------------------------------------------------------
  console.log('\n👉 [4/10] Test 4: Explicit "compare them"');
  const res4 = await generateAiResponse('compare them', '', '', offer3);
  assert(
    res4.reply.includes('Pavilion 15') && res4.reply.includes('Victus 15') && res4.responseSource === 'PRODUCT_COMPARISON',
    'Test 4: "compare them" compares active presented models',
    `Source: ${res4.responseSource}`
  );

  // ----------------------------------------------------------------
  // TEST 5: Explicit "check warranty"
  // ----------------------------------------------------------------
  console.log('\n👉 [5/10] Test 5: Explicit "check warranty"');
  const res5 = await generateAiResponse('check warranty', '', '', offer3);
  assert(
    res5.reply.includes('Warranty') && res5.responseSource === 'BUSINESS_RAG',
    'Test 5: "check warranty" returns warranty details for active models',
    `Source: ${res5.responseSource}`
  );

  // ----------------------------------------------------------------
  // TEST 6: Explicit New Search Overrides Pending Action
  // ----------------------------------------------------------------
  console.log('\n👉 [6/10] Test 6: Explicit new search "show me Lenovo laptops" overrides pending offer');
  const res6 = await generateAiResponse('show me Lenovo laptops', '', '', offer3);
  const isLenovo6 = res6.reply.includes('Lenovo') && (res6.reply.includes('IdeaPad') || res6.reply.includes('ThinkPad'));
  assert(
    isLenovo6 && res6.responseSource === 'DETERMINISTIC_FALLBACK',
    'Test 6: Explicit new search overrides pending offer and retrieves Lenovo catalog items',
    `Source: ${res6.responseSource} | Has Lenovo: ${isLenovo6}`
  );

  // ----------------------------------------------------------------
  // TEST 7: Prevent Stale 8GB RAM Leak (The Screenshot Bug)
  // ----------------------------------------------------------------
  console.log('\n👉 [7/10] Test 7: Prevent stale 8GB RAM leak into follow-up action');
  const oldHistoryWith8Gb = `CUSTOMER: "I want an HP laptop."\nCUSTOMER: "8GB RAM."\nASSISTANT: "${offer3}"`;
  const res7 = await generateAiResponse('yes', '', oldHistoryWith8Gb, offer3);
  const hasNo8GbHp15s = !res7.reply.includes('HP 15s') && !res7.reply.includes('8GB RAM');
  assert(
    hasNo8GbHp15s,
    'Test 7: Stale 8GB RAM requirement does not leak into "yes" follow-up action',
    `Reply contains HP 15s: ${res7.reply.includes('HP 15s')}`
  );

  // ----------------------------------------------------------------
  // TEST 8: Pronoun Resolution ("compare them")
  // ----------------------------------------------------------------
  console.log('\n👉 [8/10] Test 8: Pronoun resolution "compare them"');
  const parsed8 = detectIntentAndRequirements('compare them', '', assistantPresentedProducts);
  assert(
    parsed8.intent === 'PRODUCT_COMPARISON' &&
      parsed8.requirements.mentionedModels.some((m) => m.includes('Pavilion 15')) &&
      parsed8.requirements.mentionedModels.some((m) => m.includes('Victus 15')),
    'Test 8: Pronoun "them" resolves to Pavilion 15 and Victus 15',
    `Models: ${parsed8.requirements.mentionedModels.join(', ')}`
  );

  // ----------------------------------------------------------------
  // TEST 9: Warranty Pronoun ("what about warranty?")
  // ----------------------------------------------------------------
  console.log('\n👉 [9/10] Test 9: Warranty pronoun "what about warranty?"');
  const res9 = await generateAiResponse('what about warranty?', '', '', assistantPresentedProducts);
  assert(
    res9.reply.includes('Warranty') && res9.responseSource === 'BUSINESS_RAG',
    'Test 9: "what about warranty?" returns warranty for active products',
    `Source: ${res9.responseSource}`
  );

  // ----------------------------------------------------------------
  // TEST 10: Product-Specific Warranty ("warranty for the Pavilion")
  // ----------------------------------------------------------------
  console.log('\n👉 [10/10] Test 10: Product-specific warranty "warranty for the Pavilion"');
  const res10 = await generateAiResponse('warranty for the Pavilion', '', '', assistantPresentedProducts);
  assert(
    res10.reply.includes('Pavilion') && res10.reply.includes('Warranty') && res10.responseSource === 'BUSINESS_RAG',
    'Test 10: Product-specific warranty targets HP Pavilion 15',
    `Source: ${res10.responseSource} | Answer: "${res10.reply}"`
  );

  console.log('\n================================================================');
  console.log(`Follow-up Matrix Summary: \x1b[32m${passed} Passed\x1b[0m, \x1b[31m${failed} Failed\x1b[0m`);
  console.log('================================================================\n');

  if (failed > 0) process.exit(1);
}

runFollowUpActionSuite().catch((err) => {
  console.error('Follow-up test suite execution failed:', err);
  process.exit(1);
});
