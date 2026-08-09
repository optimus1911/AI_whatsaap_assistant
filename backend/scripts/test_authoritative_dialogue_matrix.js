import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

process.env.RAG_TEST_MODE = 'true';
dotenv.config({ path: path.resolve(__dirname, '../.env') });

import { detectIntentAndRequirements } from '../services/intentService.js';
import { generateAiResponse } from '../services/geminiService.js';

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

async function runAuthoritativeMatrix() {
  console.log('\n================================================================');
  console.log('🧪 RUNNING MASTER 20 ADVERSARIAL CASES (SECTION 34 VERIFICATION)');
  console.log('⚡ (Exact Real-World Scenarios from Prompt Section 34)');
  console.log('================================================================\n');

  // Shared Fixtures
  const lenovoText = 'Here is the *Lenovo IdeaPad Slim 3* — *₹38,999*\n   8GB RAM • 512GB SSD • Intel Core i3 13th Gen';
  const lenovoHistory = `CUSTOMER: "show Lenovo laptops under 50000"\nASSISTANT: "${lenovoText}"`;

  const dellListText = `Here are the top Dell laptops matching your requirements:

1. *Dell Inspiron 15 3530* — *₹48,999*
   8GB RAM • 512GB SSD • Intel Core i5 13th Gen

2. *Dell Inspiron 14 5430* — *₹67,999*
   16GB RAM • 512GB SSD • Intel Core i5 13th Gen

Would you like me to compare these two laptops?`;
  const dellListHistory = `CUSTOMER: "show Dell laptops"\nASSISTANT: "${dellListText}"`;

  // 1. Lenovo -> compare it with Dell
  console.log('--- Case 1: Active Lenovo -> Compare with Dell ---');
  {
    const r = detectIntentAndRequirements('compare it with Dell', lenovoHistory, lenovoText);
    assert(r.intent === 'PRODUCT_COMPARISON', 'Case 1: "compare it with Dell" -> PRODUCT_COMPARISON');
    assert(r.requirements.mentionedModels.some(m => m.includes('Lenovo')) && r.requirements.mentionedModels.some(m => m.includes('Dell')), 'Case 1: Compares active Lenovo with Dell');
  }

  // 2. HP -> Reset -> Dell under 60000
  console.log('\n--- Case 2: Reset -> Zero HP Leakage ---');
  {
    const hist = `CUSTOMER: "show HP laptops"\nASSISTANT: "Here is HP Pavilion 15"\nCUSTOMER: "forget everything"\nASSISTANT: "Sure — I've cleared the previous conversation context."`;
    const r = detectIntentAndRequirements('show Dell under 60000', hist);
    assert(r.intent === 'PRODUCT_SEARCH' && r.requirements.brand === 'Dell' && r.requirements.maxPrice === 60000, 'Case 2: Fresh Dell search with zero HP context');
  }

  // 3. Dell -> why did you show Dell? (Feedback/complaint, NO SEARCH)
  console.log('\n--- Case 3: "why did you show Dell?" -> Feedback (No Search) ---');
  {
    const r = detectIntentAndRequirements('why did you show Dell?', dellListHistory, dellListText);
    assert(r.intent === 'CLARIFICATION' && r.searchAllowed === false, 'Case 3: "why did you show Dell?" is CLARIFICATION (searchAllowed=false)');
  }

  // 4. Dell -> what about Dell? (Clarification, no blind search)
  console.log('\n--- Case 4: "what about Dell?" -> Clarification ---');
  {
    const r = detectIntentAndRequirements('what about Dell?', lenovoHistory, lenovoText);
    assert(r.intent === 'CLARIFICATION' && r.searchAllowed === false, 'Case 4: "what about Dell?" does NOT trigger product search');
  }

  // 5. Dell list -> first one
  console.log('\n--- Case 5: "first one" -> Select First Dell ---');
  {
    const res = await generateAiResponse('first one', '', dellListHistory, dellListText);
    assert(res.reply.includes('Dell Inspiron 15 3530'), 'Case 5: "first one" selects Dell Inspiron 15 3530');
  }

  // 6. Dell -> what is its warranty?
  console.log('\n--- Case 6: "what is its warranty?" -> Warranty for Active Model ---');
  {
    const singleDellText = 'Here is the *Dell Inspiron 15 3530* — *₹48,999*';
    const hist = `CUSTOMER: "show Dell"\nASSISTANT: "${singleDellText}"`;
    const r = detectIntentAndRequirements('what is its warranty?', hist, singleDellText);
    assert(r.intent === 'WARRANTY_QUERY' && r.searchAllowed === false, 'Case 6: "what is its warranty?" -> WARRANTY_QUERY');
  }

  // 7. Lenovo -> actually Dell (Brand correction)
  console.log('\n--- Case 7: "actually Dell" -> Brand Correction ---');
  {
    const r = detectIntentAndRequirements('actually Dell', lenovoHistory, lenovoText);
    assert(r.requirements.brand === 'Dell', 'Case 7: "actually Dell" corrects brand to Dell');
  }

  // 8. Lenovo under 60000 with 16GB RAM -> actually Dell
  console.log('\n--- Case 8: Constraint Preservation on Brand Correction ---');
  {
    const hist8 = `CUSTOMER: "show Lenovo laptops under 60000 with 16GB RAM"\nASSISTANT: "${lenovoText}"`;
    const r = detectIntentAndRequirements('actually Dell', hist8, lenovoText);
    assert(r.requirements.brand === 'Dell', 'Case 8: Brand updated to Dell');
    assert(r.requirements.maxPrice === 60000, 'Case 8: Budget preserved as ₹60,000');
    assert(r.requirements.ram === '16GB', 'Case 8: RAM preserved as 16GB');
  }

  // 9. what is delivery time?
  console.log('\n--- Case 9: "what is delivery time?" -> BUSINESS_RAG ---');
  {
    const r = detectIntentAndRequirements('what is delivery time?', '');
    assert(r.intent === 'DELIVERY_QUERY' && r.searchAllowed === false, 'Case 9: "what is delivery time?" -> DELIVERY_QUERY');
  }

  // 10. what si ddelivery time
  console.log('\n--- Case 10: "what si ddelivery time" -> Typo Policy ---');
  {
    const r = detectIntentAndRequirements('what si ddelivery time', '');
    assert(r.intent === 'DELIVERY_QUERY' && r.searchAllowed === false, 'Case 10: "what si ddelivery time" -> DELIVERY_QUERY');
  }

  // 11. del laptop under 60000
  console.log('\n--- Case 11: "del laptop under 60000" -> Dell Search ---');
  {
    const r = detectIntentAndRequirements('del laptop under 60000', '');
    assert(r.intent === 'PRODUCT_SEARCH' && r.requirements.brand === 'Dell' && r.requirements.maxPrice === 60000, 'Case 11: Dell search under ₹60,000');
  }

  // 12. why are you showing me laptops?
  console.log('\n--- Case 12: "why are you showing me laptops?" -> Feedback (No Search) ---');
  {
    const r = detectIntentAndRequirements('why are you showing me laptops?', dellListHistory, dellListText);
    assert(r.intent === 'CLARIFICATION' && r.searchAllowed === false, 'Case 12: Feedback question is CLARIFICATION');
  }

  // 13. which one is cheaper?
  console.log('\n--- Case 13: "which one is cheaper?" -> Compare by Price ---');
  {
    const res = await generateAiResponse('which one is cheaper?', '', dellListHistory, dellListText);
    assert(res.reply.includes('Dell Inspiron 15 3530'), 'Case 13: Identifies cheaper model (₹48,999)');
  }

  // 14. the other one
  console.log('\n--- Case 14: "the other one" -> Alternate Active Entity ---');
  {
    const res = await generateAiResponse('the other one', '', dellListHistory, dellListText);
    assert(res.reply.includes('Dell Inspiron 14 5430'), 'Case 14: Selects Dell Inspiron 14 5430');
  }

  // 15. pehla wala kitne ka hai?
  console.log('\n--- Case 15: "pehla wala kitne ka hai?" -> Hinglish Price Query ---');
  {
    const r = detectIntentAndRequirements('pehla wala kitne ka hai?', dellListHistory, dellListText);
    assert(r.intent === 'PRICE_QUERY' || r.intent === 'PRODUCT_SELECTION', 'Case 15: Hinglish price query resolved');
  }

  // 16. ye wala available hai kya?
  console.log('\n--- Case 16: "ye wala available hai kya?" -> Hinglish Availability ---');
  {
    const singleDellText = 'Here is the *Dell Inspiron 15 3530* — *₹48,999*';
    const hist = `CUSTOMER: "show Dell"\nASSISTANT: "${singleDellText}"`;
    const r = detectIntentAndRequirements('ye wala available hai kya?', hist, singleDellText);
    assert(r.intent === 'AVAILABILITY_QUERY' && r.searchAllowed === false, 'Case 16: Hinglish availability resolved');
  }

  // 17. nahi ye nahi chahiye
  console.log('\n--- Case 17: "nahi ye nahi chahiye" -> Rejection ---');
  {
    const r = detectIntentAndRequirements('nahi ye nahi chahiye', dellListHistory, dellListText);
    assert(r.intent === 'DENIAL' || r.isDenial === true, 'Case 17: Rejection recognized');
    assert(r.searchAllowed === false, 'Case 17: Rejection does not search automatically');
  }

  // 18. haan
  console.log('\n--- Case 18: "haan" -> Contextual Confirmation ---');
  {
    const r = detectIntentAndRequirements('haan', '', 'Would you like me to compare these laptops?');
    assert(r.intent === 'PRODUCT_COMPARISON', 'Case 18: "haan" resolves to pending compare action');
  }

  // 19. return kaise karu?
  console.log('\n--- Case 19: "return kaise karu?" -> Return Policy ---');
  {
    const r = detectIntentAndRequirements('return kaise karu?', '');
    assert(r.intent === 'RETURN_POLICY' && r.searchAllowed === false, 'Case 19: "return kaise karu?" -> RETURN_POLICY');
  }

  // 20. show Asus
  console.log('\n--- Case 20: "show Asus" -> ASUS Search ---');
  {
    const r = detectIntentAndRequirements('show Asus', '');
    assert(r.intent === 'PRODUCT_SEARCH' && r.requirements.brand === 'ASUS' && r.searchAllowed === true, 'Case 20: "show Asus" -> ASUS PRODUCT_SEARCH');
  }

  console.log('\n----------------------------------------------------------------');
  console.log(`Authoritative Matrix Summary: \x1b[32m${passed} Passed\x1b[0m, \x1b[31m${failed} Failed\x1b[0m`);
  console.log('----------------------------------------------------------------\n');

  if (failed > 0) process.exit(1);
}

runAuthoritativeMatrix();
