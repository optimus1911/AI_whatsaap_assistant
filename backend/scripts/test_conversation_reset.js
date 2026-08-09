import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

process.env.RAG_TEST_MODE = 'true';
dotenv.config({ path: path.resolve(__dirname, '../.env') });

import { detectIntentAndRequirements } from '../services/intentService.js';
import { executeRagRetrieval } from '../services/ragService.js';
import { generateAiResponse } from '../services/geminiService.js';
import { searchProducts } from '../services/productSearchService.js';

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

async function runResetAndBrandTests() {
  console.log('\n================================================================');
  console.log('🧪 RUNNING CONVERSATION RESET, BRAND TYPO & SEARCH GATE SUITE');
  console.log('⚡ (20 Comprehensive Tests - Live Reset, Typo & Gate Audit)');
  console.log('================================================================\n');

  // Test 1: "forget everything" -> CONVERSATION_RESET
  console.log('--- Test 1-4: Reset Phrases Intent Detection ---');
  {
    const r = detectIntentAndRequirements('forget everything', 'CUSTOMER: "Lenovo under 50000"');
    assert(r.intent === 'CONVERSATION_RESET', '"forget everything" -> CONVERSATION_RESET', `Got: ${r.intent}`);
    assert(r.searchAllowed === false, 'searchAllowed is false', `Got: ${r.searchAllowed}`);
  }

  // Test 2: "forget every chat" -> CONVERSATION_RESET
  {
    const r = detectIntentAndRequirements('forget every chat', 'CUSTOMER: "Lenovo under 50000"');
    assert(r.intent === 'CONVERSATION_RESET', '"forget every chat" -> CONVERSATION_RESET', `Got: ${r.intent}`);
    assert(r.searchAllowed === false, 'searchAllowed is false', `Got: ${r.searchAllowed}`);
  }

  // Test 3: "start fresh" -> CONVERSATION_RESET
  {
    const r = detectIntentAndRequirements('start fresh', 'CUSTOMER: "Lenovo under 50000"');
    assert(r.intent === 'CONVERSATION_RESET', '"start fresh" -> CONVERSATION_RESET', `Got: ${r.intent}`);
    assert(r.searchAllowed === false, 'searchAllowed is false', `Got: ${r.searchAllowed}`);
  }

  // Test 4: "start over" -> CONVERSATION_RESET
  {
    const r = detectIntentAndRequirements('start over', 'CUSTOMER: "Lenovo under 50000"');
    assert(r.intent === 'CONVERSATION_RESET', '"start over" -> CONVERSATION_RESET', `Got: ${r.intent}`);
    assert(r.searchAllowed === false, 'searchAllowed is false', `Got: ${r.searchAllowed}`);
  }

  // Test 5: Reset clears activeProducts
  console.log('\n--- Test 5-8: State Isolation & Catalog Preservation ---');
  {
    const r = detectIntentAndRequirements(
      'forget everything',
      'CUSTOMER: "show Lenovo"',
      'Here is the Lenovo IdeaPad Slim 3 for ₹38,999.'
    );
    assert(r.activeEntities.length === 0, 'Reset clears activeEntities (0 products)', `Got: ${r.activeEntities.length}`);
  }

  // Test 6: Reset clears pendingAction
  {
    const r = detectIntentAndRequirements(
      'forget everything',
      'CUSTOMER: "show Lenovo"',
      'Would you like me to check warranty for Lenovo IdeaPad Slim 3?'
    );
    assert(r.pendingAction.type === 'NONE' || r.pendingAction.offeredActions.length === 0, 'Reset clears pendingAction', `Got: ${JSON.stringify(r.pendingAction)}`);
  }

  // Test 7: Reset clears historical requirements
  {
    const history = 'CUSTOMER: "I want a Lenovo laptop with 16GB RAM for coding under 50000"\nASSISTANT: "Here are Lenovo laptops."\nCUSTOMER: "forget everything"\nASSISTANT: "Sure — I\'ve cleared the previous conversation context. What would you like help with?"';
    const r = detectIntentAndRequirements('laptop under 60000', history);
    assert(r.requirements.brand === null, 'Brand is null (Lenovo not inherited)', `Got: ${r.requirements.brand}`);
    assert(r.requirements.ram === null, 'RAM is null (16GB not inherited)', `Got: ${r.requirements.ram}`);
    assert(r.requirements.useCase === null, 'UseCase is null (coding not inherited)', `Got: ${r.requirements.useCase}`);
    assert(r.requirements.maxPrice === 60000, 'MaxPrice is 60000 (from current turn)', `Got: ${r.requirements.maxPrice}`);
  }

  // Test 8: Reset preserves product catalog
  {
    const catalog = await searchProducts({});
    assert(catalog.length > 0, 'Product catalog remains fully intact and available', `Found: ${catalog.length} items`);
  }

  // Test 9: "del laptop under 60000" -> Dell
  console.log('\n--- Test 9-12: Brand Typo Normalization & Search Evidence ---');
  {
    const r = detectIntentAndRequirements('del laptop under 60000', 'CUSTOMER: "Lenovo under 50000"');
    assert(r.intent === 'PRODUCT_SEARCH', '"del laptop under 60000" -> PRODUCT_SEARCH', `Got: ${r.intent}`);
    assert(r.requirements.brand === 'Dell', 'Brand normalized from "del" to "Dell"', `Got: ${r.requirements.brand}`);
    assert(r.requirements.maxPrice === 60000, 'MaxPrice is 60000', `Got: ${r.requirements.maxPrice}`);
    assert(r.searchAllowed === true, 'searchAllowed is true', `Got: ${r.searchAllowed}`);
  }

  // Test 10: "dle laptop" -> Dell
  {
    const r = detectIntentAndRequirements('dle laptop', '');
    assert(r.intent === 'PRODUCT_SEARCH', '"dle laptop" -> PRODUCT_SEARCH', `Got: ${r.intent}`);
    assert(r.requirements.brand === 'Dell', 'Brand normalized from "dle" to "Dell"', `Got: ${r.requirements.brand}`);
  }

  // Test 11: "show Dell laptops" -> PRODUCT_SEARCH
  {
    const r = detectIntentAndRequirements('show Dell laptops', '');
    assert(r.intent === 'PRODUCT_SEARCH', '"show Dell laptops" -> PRODUCT_SEARCH', `Got: ${r.intent}`);
    assert(r.requirements.brand === 'Dell', 'Brand is Dell', `Got: ${r.requirements.brand}`);
    assert(r.searchAllowed === true, 'searchAllowed is true', `Got: ${r.searchAllowed}`);
  }

  // Test 12: "find Dell under 60000" -> PRODUCT_SEARCH
  {
    const r = detectIntentAndRequirements('find Dell under 60000', '');
    assert(r.intent === 'PRODUCT_SEARCH', '"find Dell under 60000" -> PRODUCT_SEARCH', `Got: ${r.intent}`);
    assert(r.requirements.brand === 'Dell', 'Brand is Dell', `Got: ${r.requirements.brand}`);
    assert(r.requirements.maxPrice === 60000, 'MaxPrice is 60000', `Got: ${r.requirements.maxPrice}`);
  }

  // Test 13: "why did you choose Dell?" -> NOT PRODUCT_SEARCH
  console.log('\n--- Test 13-17: Conversational Question Gate (No Product Search) ---');
  {
    const r = detectIntentAndRequirements('why did you choose Dell?', '', 'Here is the Dell Inspiron 15.');
    assert(r.intent !== 'PRODUCT_SEARCH', '"why did you choose Dell?" is NOT PRODUCT_SEARCH', `Got: ${r.intent}`);
    assert(r.searchAllowed === false, 'searchAllowed is false', `Got: ${r.searchAllowed}`);
  }

  // Test 14: "why did you show Dell?" -> NOT PRODUCT_SEARCH
  {
    const r = detectIntentAndRequirements('why did you show Dell?', '', 'Here is the Dell Inspiron 15.');
    assert(r.intent !== 'PRODUCT_SEARCH', '"why did you show Dell?" is NOT PRODUCT_SEARCH', `Got: ${r.intent}`);
    assert(r.searchAllowed === false, 'searchAllowed is false', `Got: ${r.searchAllowed}`);
  }

  // Test 15: "why didn't you compare Dell?" -> NOT PRODUCT_SEARCH
  {
    const r = detectIntentAndRequirements('why didn\'t you compare Dell?', '', 'Here is the HP Pavilion 15.');
    assert(r.intent !== 'PRODUCT_SEARCH', '"why didn\'t you compare Dell?" is NOT PRODUCT_SEARCH', `Got: ${r.intent}`);
    assert(r.searchAllowed === false, 'searchAllowed is false', `Got: ${r.searchAllowed}`);
  }

  // Test 16: "what about Dell?" -> NOT automatic PRODUCT_SEARCH
  {
    const r = detectIntentAndRequirements('what about Dell?', '', 'Here is the HP Pavilion 15.');
    assert(r.intent !== 'PRODUCT_SEARCH', '"what about Dell?" is NOT automatic PRODUCT_SEARCH', `Got: ${r.intent}`);
    assert(r.searchAllowed === false, 'searchAllowed is false', `Got: ${r.searchAllowed}`);
  }

  // Test 17: "i didn't ask for Dell" -> NOT PRODUCT_SEARCH
  {
    const r = detectIntentAndRequirements('i didn\'t ask for Dell', '', 'Here is the Dell Inspiron 15.');
    assert(r.intent !== 'PRODUCT_SEARCH', '"i didn\'t ask for Dell" is NOT PRODUCT_SEARCH', `Got: ${r.intent}`);
    assert(r.searchAllowed === false, 'searchAllowed is false', `Got: ${r.searchAllowed}`);
  }

  // Test 18: "sorry i needed Dell laptop" -> PRODUCT_SEARCH (Correction + Product Request)
  console.log('\n--- Test 18: Explicit Correction + Product Request ---');
  {
    const r = detectIntentAndRequirements('sorry i needed Dell laptop', '', 'Here is the Lenovo IdeaPad Slim 3.');
    assert(r.intent === 'PRODUCT_SEARCH', '"sorry i needed Dell laptop" -> PRODUCT_SEARCH', `Got: ${r.intent}`);
    assert(r.requirements.brand === 'Dell', 'Brand is Dell', `Got: ${r.requirements.brand}`);
    assert(r.searchAllowed === true, 'searchAllowed is true', `Got: ${r.searchAllowed}`);
  }

  // Test 19: Reset followed by Dell search -> Dell, not Lenovo
  console.log('\n--- Test 19: Reset Followed by Search ---');
  {
    const history = 'CUSTOMER: "show me Lenovo laptops under 50000"\nASSISTANT: "Here are Lenovo laptops under ₹50,000."\nCUSTOMER: "forget everything"\nASSISTANT: "Sure — I\'ve cleared the previous conversation context. What would you like help with?"';
    const response = await generateAiResponse('show me Dell laptops', '', history, 'Sure — I\'ve cleared the previous conversation context. What would you like help with?');
    assert(response.reply.includes('Dell') && !response.reply.includes('Lenovo'), 'Dell search after reset returns Dell only (no Lenovo leakage)', `Reply sample: "${response.reply.slice(0, 80)}..."`);
  }

  // Test 20: Exact Production Conversation Sequence
  console.log('\n--- Test 20: Exact Production Failure Sequence ---');
  {
    // Step 1: Customer resets
    const r1 = detectIntentAndRequirements('forget every chat we did yet', 'CUSTOMER: "Lenovo laptops under 50000"');
    assert(r1.intent === 'CONVERSATION_RESET', 'Step 1: "forget every chat we did yet" -> CONVERSATION_RESET', `Got: ${r1.intent}`);

    // Step 2: Customer asks with typo "del"
    const r2 = detectIntentAndRequirements('hi i need del laptop under 60000', 'CUSTOMER: "Lenovo laptops"\nCUSTOMER: "forget every chat we did yet"\nASSISTANT: "Sure — I\'ve cleared the previous conversation context."');
    assert(r2.intent === 'PRODUCT_SEARCH', 'Step 2: "hi i need del laptop under 60000" -> PRODUCT_SEARCH', `Got: ${r2.intent}`);
    assert(r2.requirements.brand === 'Dell', 'Step 2: Brand is Dell (not Lenovo)', `Got: ${r2.requirements.brand}`);
    assert(r2.requirements.maxPrice === 60000, 'Step 2: MaxPrice is 60000', `Got: ${r2.requirements.maxPrice}`);

    // Step 3: Customer asks conversational question
    const historyStep3 = 'CUSTOMER: "hi i need del laptop under 60000"\nASSISTANT: "Here are the Dell laptops under ₹60,000: Dell Vostro 3520, Dell Inspiron 15 3530."';
    const lastAssistantStep3 = 'Here are the Dell laptops under ₹60,000: Dell Vostro 3520, Dell Inspiron 15 3530.';
    const r3 = detectIntentAndRequirements('why did you were not clearify dell with dell', historyStep3, lastAssistantStep3);

    assert(r3.intent !== 'PRODUCT_SEARCH', 'Step 3: Intent is NOT PRODUCT_SEARCH', `Got: ${r3.intent}`);
    assert(r3.searchAllowed === false, 'Step 3: searchAllowed is false', `Got: ${r3.searchAllowed}`);

    const res3 = await generateAiResponse('why did you were not clearify dell with dell', '', historyStep3, lastAssistantStep3);
    assert(res3.responseSource !== 'UNKNOWN', 'Step 3: Response source is NOT UNKNOWN', `Got: ${res3.responseSource}`);
    assert(!res3.reply.toLowerCase().includes('here are the dell laptops'), 'Step 3: Does NOT repeat product catalog search', `Got: ${res3.reply}`);
  }

  console.log('\n----------------------------------------------------------------');
  console.log(`Reset & Gate Test Summary: \x1b[32m${passed} Passed\x1b[0m, \x1b[31m${failed} Failed\x1b[0m`);
  console.log('----------------------------------------------------------------\n');

  if (failed > 0) process.exit(1);
}

runResetAndBrandTests();
