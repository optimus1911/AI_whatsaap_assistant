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

async function runComparisonTargetTests() {
  console.log('\n================================================================');
  console.log('🔬 RUNNING EXPLICIT COMPARISON & CROSS-BRAND TARGET SUITE');
  console.log('⚡ (10-Test Context Isolation & Dynamic Entity Resolution Matrix)');
  console.log('================================================================\n');

  const lenovoWarrantyResponse = `The *Lenovo IdeaPad Slim 3* includes a *1-Year Official Manufacturer Brand Warranty* covering all hardware components and manufacturing defects across authorized brand service centers in India.`;

  const lenovoProductResponse = `Here are the lenovo laptops under ₹50,000:

1. *Lenovo IdeaPad Slim 3* — *₹38,999*
   8GB RAM • 512GB SSD • Intel Core i3 13th Gen

Would you like me to check warranty details for the Lenovo IdeaPad Slim 3?`;

  const fullHpLenovoHistory = `CUSTOMER: "I want an HP laptop."
ASSISTANT: "Here is the HP Pavilion 15 and HP 15s."
CUSTOMER: "lenovo under 50000"
ASSISTANT: "${lenovoProductResponse}"
CUSTOMER: "yes"
ASSISTANT: "${lenovoWarrantyResponse}"`;

  // ----------------------------------------------------------------
  // TEST 1 — Exact production bug
  // ----------------------------------------------------------------
  console.log('👉 [1/10] TEST 1: Exact production bug - "compare it with dell" after HP + Lenovo turns');
  const res1 = await generateAiResponse('compare it with dell', '', fullHpLenovoHistory, lenovoWarrantyResponse);
  const isLenovoDell1 = res1.reply.includes('Lenovo IdeaPad Slim 3') && res1.reply.includes('Dell');
  const hasNoHp1 = !res1.reply.includes('HP Pavilion 15') && !res1.reply.includes('HP 15s');
  assert(
    isLenovoDell1 && hasNoHp1 && res1.responseSource === 'PRODUCT_COMPARISON',
    'TEST 1: "compare it with dell" compares Lenovo IdeaPad Slim 3 vs Dell (Zero HP leak)',
    `Source: ${res1.responseSource} | Output has Lenovo: ${res1.reply.includes('Lenovo')} | Has Dell: ${res1.reply.includes('Dell')} | Has HP: ${res1.reply.includes('HP')}`
  );

  // ----------------------------------------------------------------
  // TEST 2 — Explicit brand comparison
  // ----------------------------------------------------------------
  console.log('\n👉 [2/10] TEST 2: "compare Lenovo IdeaPad Slim 3 with Dell"');
  const res2 = await generateAiResponse('compare Lenovo IdeaPad Slim 3 with Dell', '', fullHpLenovoHistory, lenovoWarrantyResponse);
  const isLenovoDell2 = res2.reply.includes('Lenovo IdeaPad Slim 3') && res2.reply.includes('Dell');
  assert(
    isLenovoDell2 && res2.responseSource === 'PRODUCT_COMPARISON',
    'TEST 2: Explicit source model + target brand compares Lenovo vs Dell',
    `Source: ${res2.responseSource}`
  );

  // ----------------------------------------------------------------
  // TEST 3 — Pronoun + brand
  // ----------------------------------------------------------------
  console.log('\n👉 [3/10] TEST 3: "compare it with Dell" with preceding Lenovo context');
  const res3 = await generateAiResponse('compare it with Dell', '', '', lenovoProductResponse);
  const isLenovoDell3 = res3.reply.includes('Lenovo IdeaPad Slim 3') && res3.reply.includes('Dell');
  assert(
    isLenovoDell3 && res3.responseSource === 'PRODUCT_COMPARISON',
    'TEST 3: Pronoun "it" resolves to preceding Lenovo IdeaPad Slim 3 vs Dell',
    `Source: ${res3.responseSource}`
  );

  // ----------------------------------------------------------------
  // TEST 4 — VS syntax
  // ----------------------------------------------------------------
  console.log('\n👉 [4/10] TEST 4: "Lenovo IdeaPad Slim 3 vs Dell"');
  const res4 = await generateAiResponse('Lenovo IdeaPad Slim 3 vs Dell', '', fullHpLenovoHistory, lenovoWarrantyResponse);
  const isLenovoDell4 = res4.reply.includes('Lenovo IdeaPad Slim 3') && res4.reply.includes('Dell');
  assert(
    isLenovoDell4 && res4.responseSource === 'PRODUCT_COMPARISON',
    'TEST 4: "vs" operator resolves to side-by-side comparison',
    `Source: ${res4.responseSource}`
  );

  // ----------------------------------------------------------------
  // TEST 5 — Against syntax
  // ----------------------------------------------------------------
  console.log('\n👉 [5/10] TEST 5: "compare this against Dell"');
  const res5 = await generateAiResponse('compare this against Dell', '', '', lenovoProductResponse);
  const isLenovoDell5 = res5.reply.includes('Lenovo IdeaPad Slim 3') && res5.reply.includes('Dell');
  assert(
    isLenovoDell5 && res5.responseSource === 'PRODUCT_COMPARISON',
    'TEST 5: "against" operator resolves to Lenovo vs Dell comparison',
    `Source: ${res5.responseSource}`
  );

  // ----------------------------------------------------------------
  // TEST 6 — Alternative syntax
  // ----------------------------------------------------------------
  console.log('\n👉 [6/10] TEST 6: "show me a Dell alternative to this"');
  const res6 = await generateAiResponse('show me a Dell alternative to this', '', '', lenovoProductResponse);
  const isLenovoDell6 = res6.reply.includes('Lenovo IdeaPad Slim 3') && res6.reply.includes('Dell');
  assert(
    isLenovoDell6 && res6.responseSource === 'PRODUCT_COMPARISON',
    'TEST 6: "alternative to this" resolves to comparable Dell product comparison',
    `Source: ${res6.responseSource}`
  );

  // ----------------------------------------------------------------
  // TEST 7 — Historical HP isolation
  // ----------------------------------------------------------------
  console.log('\n👉 [7/10] TEST 7: Historical HP isolation (Zero HP models present in response)');
  const res7 = await generateAiResponse('compare it with Dell', '', fullHpLenovoHistory, lenovoWarrantyResponse);
  const containsNoHp = !res7.reply.toLowerCase().includes('hp pavilion') && !res7.reply.toLowerCase().includes('hp 15s');
  assert(
    containsNoHp && res7.reply.includes('Dell') && res7.reply.includes('Lenovo'),
    'TEST 7: Historical HP models are completely isolated from current comparison',
    `Contains HP: ${!containsNoHp}`
  );

  // ----------------------------------------------------------------
  // TEST 8 — Explicit new brand overrides previous brand
  // ----------------------------------------------------------------
  console.log('\n👉 [8/10] TEST 8: Explicit new brand overrides previous brand');
  const historyHpThenLenovo = `CUSTOMER: "I want an HP laptop."\nCUSTOMER: "show me Lenovo laptops"\nASSISTANT: "${lenovoProductResponse}"`;
  const res8 = await generateAiResponse('compare it with Dell', '', historyHpThenLenovo, lenovoProductResponse);
  assert(
    res8.reply.includes('Lenovo IdeaPad Slim 3') && res8.reply.includes('Dell') && !res8.reply.includes('HP'),
    'TEST 8: Active Lenovo replaces old HP brand constraint cleanly',
    `Source: ${res8.responseSource}`
  );

  // ----------------------------------------------------------------
  // TEST 9 — Pending action override
  // ----------------------------------------------------------------
  console.log('\n👉 [9/10] TEST 9: Pending action override (Comparison overrides pending warranty offer)');
  const pendingWarrantyOffer = `Here is the Lenovo IdeaPad Slim 3. Would you like warranty details?`;
  const res9 = await generateAiResponse('compare it with Dell', '', '', pendingWarrantyOffer);
  assert(
    res9.responseSource === 'PRODUCT_COMPARISON' && res9.reply.includes('Dell') && res9.reply.includes('Lenovo'),
    'TEST 9: "compare it with Dell" overrides pending warranty offer and executes comparison',
    `Source: ${res9.responseSource}`
  );

  // ----------------------------------------------------------------
  // TEST 10 — Explicit product-to-product comparison
  // ----------------------------------------------------------------
  console.log('\n👉 [10/10] TEST 10: "compare Lenovo IdeaPad Slim 3 with Dell Inspiron 15"');
  const res10 = await generateAiResponse('compare Lenovo IdeaPad Slim 3 with Dell Inspiron 15', '', '', '');
  const isExact10 = res10.reply.includes('Lenovo IdeaPad Slim 3') && res10.reply.includes('Dell Inspiron');
  assert(
    isExact10 && res10.responseSource === 'PRODUCT_COMPARISON',
    'TEST 10: Exact product-to-product comparison resolves both specific models from catalog',
    `Source: ${res10.responseSource}`
  );

  console.log('\n================================================================');
  console.log(`Comparison Target Matrix Summary: \x1b[32m${passed} Passed\x1b[0m, \x1b[31m${failed} Failed\x1b[0m`);
  console.log('================================================================\n');

  if (failed > 0) process.exit(1);
}

runComparisonTargetTests().catch((err) => {
  console.error('Comparison target test suite failed:', err);
  process.exit(1);
});
