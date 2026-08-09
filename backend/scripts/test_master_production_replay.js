import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

process.env.RAG_TEST_MODE = 'true';
dotenv.config({ path: path.resolve(__dirname, '../.env') });

import { detectIntentAndRequirements } from '../services/intentService.js';
import { generateAiResponse } from '../services/geminiService.js';
import { validateResponse, buildConversationContext } from '../services/conversationContextService.js';

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

async function runMasterProductionReplay() {
  console.log('\n================================================================');
  console.log('🧪 RUNNING MASTER PRODUCTION REPLAY & REGRESSION MATRIX');
  console.log('⚡ (25 End-to-End Production Scenarios & Conversational Safety)');
  console.log('================================================================\n');

  // Shared Fixtures
  const singleLenovoText = 'Here is the *Lenovo IdeaPad Slim 3* — *₹38,999*\n   8GB RAM • 512GB SSD • Intel Core i3 13th Gen\n\nWould you like me to check warranty details for the Lenovo IdeaPad Slim 3?';
  const singleLenovoHistory = `CUSTOMER: "show Lenovo under 50000"\nASSISTANT: "${singleLenovoText}"`;

  const comparisonDellText = `Here is a side-by-side comparison between the *Dell Inspiron 15 3530* and *Dell Inspiron 14 5430*:

• *Price:* Dell Inspiron 15 3530 (₹48,999) vs Dell Inspiron 14 5430 (₹67,999) [Diff: ₹19,000]
• *RAM:* 8GB vs 16GB
• *Storage:* 512GB SSD vs 512GB SSD

Which of these two fits your requirements better?`;
  const comparisonDellHistory = `CUSTOMER: "compare Dell Inspiron 15 and Dell Inspiron 14"\nASSISTANT: "${comparisonDellText}"`;

  // Flow 1: "what si ddelivery time" -> DELIVERY_QUERY
  console.log('--- Flow 1: Typo Policy Routing ---');
  {
    const r = detectIntentAndRequirements('what si ddelivery time', singleLenovoHistory, singleLenovoText);
    assert(r.intent === 'DELIVERY_QUERY' && r.searchAllowed === false, 'Flow 1: "what si ddelivery time" -> DELIVERY_QUERY (searchAllowed=false)');
  }

  // Flow 2: "compare it with Dell" (active Lenovo) -> Lenovo vs Dell
  console.log('\n--- Flow 2: Cross-Brand Referential Comparison ---');
  {
    const r = detectIntentAndRequirements('compare it with Dell', singleLenovoHistory, singleLenovoText);
    assert(r.intent === 'PRODUCT_COMPARISON', 'Flow 2: "compare it with Dell" -> PRODUCT_COMPARISON');
    assert(r.requirements.mentionedModels.some(m => m.includes('Lenovo')) && r.requirements.mentionedModels.some(m => m.includes('Dell')), 'Flow 2: Correctly compares Lenovo with Dell candidate (no stale HP)');
  }

  // Flow 3: "that one" -> Referential pronoun resolution
  console.log('\n--- Flow 3: Contextual Pronoun ---');
  {
    const r = detectIntentAndRequirements('that one', singleLenovoHistory, singleLenovoText);
    assert(r.intent === 'PRODUCT_SEARCH' && r.requirements.brand === 'Lenovo', 'Flow 3: "that one" resolves to active single Lenovo');
  }

  // Flow 4: "i think 1st one" -> product #1
  console.log('\n--- Flow 4: Ordinal 1 Selection ---');
  {
    const res = await generateAiResponse('i think 1st one', '', comparisonDellHistory, comparisonDellText);
    assert(res.reply.includes('Dell Inspiron 15 3530'), 'Flow 4: "i think 1st one" selects Dell Inspiron 15 3530');
  }

  // Flow 5: "i think 1st one fits me well" -> product #1 confirmation
  console.log('\n--- Flow 5: Ordinal 1 Natural Phrasing ---');
  {
    const res = await generateAiResponse('i think 1st one fits me well', '', comparisonDellHistory, comparisonDellText);
    assert(res.reply.includes('Dell Inspiron 15 3530'), 'Flow 5: "i think 1st one fits me well" selects Dell Inspiron 15 3530');
  }

  // Flow 6: "what about warranty?" -> WARRANTY_QUERY for active entity
  console.log('\n--- Flow 6: Contextual Warranty ---');
  {
    const r = detectIntentAndRequirements('what about warranty?', singleLenovoHistory, singleLenovoText);
    assert(r.intent === 'WARRANTY_QUERY', 'Flow 6: "what about warranty?" -> WARRANTY_QUERY');
  }

  // Flow 7: "is this available to you" -> AVAILABILITY_QUERY
  console.log('\n--- Flow 7: Availability Query ---');
  {
    const r = detectIntentAndRequirements('is this available to you', singleLenovoHistory, singleLenovoText);
    assert(r.intent === 'AVAILABILITY_QUERY', 'Flow 7: "is this available to you" -> AVAILABILITY_QUERY');
  }

  // Flow 8: "forget every chat we did yet" -> CONVERSATION_RESET
  console.log('\n--- Flow 8: Conversational Reset ---');
  {
    const r = detectIntentAndRequirements('forget every chat we did yet', singleLenovoHistory, singleLenovoText);
    assert(r.intent === 'CONVERSATION_RESET' && r.searchAllowed === false, 'Flow 8: "forget every chat we did yet" -> CONVERSATION_RESET');
  }

  // Flow 9: "hi i need del laptop under 60000" -> Dell search
  console.log('\n--- Flow 9: Brand Typo + Search Request ---');
  {
    const r = detectIntentAndRequirements('hi i need del laptop under 60000', '');
    assert(r.intent === 'PRODUCT_SEARCH' && r.requirements.brand === 'Dell' && r.requirements.maxPrice === 60000, 'Flow 9: "del laptop under 60000" -> Dell PRODUCT_SEARCH (₹60,000)');
  }

  // Flow 10: "sorry i needed dell laptop" -> Dell search
  console.log('\n--- Flow 10: Correction + Search Request ---');
  {
    const r = detectIntentAndRequirements('sorry i needed dell laptop', singleLenovoHistory, singleLenovoText);
    assert(r.intent === 'PRODUCT_SEARCH' && r.requirements.brand === 'Dell', 'Flow 10: "sorry i needed dell laptop" -> Dell PRODUCT_SEARCH');
  }

  // Flow 11: "why did you were not clearify dell with dell" -> CLARIFICATION (no search)
  console.log('\n--- Flow 11: Conversational Feedback Gate ---');
  {
    const r = detectIntentAndRequirements('why did you were not clearify dell with dell', comparisonDellHistory, comparisonDellText);
    assert(r.intent === 'CLARIFICATION' && r.searchAllowed === false, 'Flow 11: Conversational feedback is CLARIFICATION (searchAllowed=false)');
  }

  // Flow 12: "hp" during comparison -> Contextual Clarification
  console.log('\n--- Flow 12: Standalone Brand Inquiry ---');
  {
    const res = await generateAiResponse('hp', '', comparisonDellHistory, comparisonDellText);
    assert(res.reply.toLowerCase().includes('hp') && (res.reply.toLowerCase().includes('compare') || res.reply.toLowerCase().includes('search')), 'Flow 12: "hp" asks contextual compare or search question');
  }

  // Flow 13: "what about Dell?" -> CLARIFICATION / No search
  console.log('\n--- Flow 13: Conversational Brand Question ---');
  {
    const r = detectIntentAndRequirements('what about Dell?', singleLenovoHistory, singleLenovoText);
    assert(r.intent === 'CLARIFICATION' && r.searchAllowed === false, 'Flow 13: "what about Dell?" does NOT trigger product search');
  }

  // Flow 14: "why did you show Dell?" -> CLARIFICATION
  console.log('\n--- Flow 14: Feedback on Assistant Action ---');
  {
    const r = detectIntentAndRequirements('why did you show Dell?', comparisonDellHistory, comparisonDellText);
    assert(r.intent === 'CLARIFICATION' && r.searchAllowed === false, 'Flow 14: "why did you show Dell?" is CLARIFICATION (no search)');
  }

  // Flow 15: "the other one" -> Second product in comparison
  console.log('\n--- Flow 15: Alternate Option Selection ---');
  {
    const res = await generateAiResponse('the other one', '', comparisonDellHistory, comparisonDellText);
    assert(res.reply.includes('Dell Inspiron 14 5430'), 'Flow 15: "the other one" selects Dell Inspiron 14 5430');
  }

  // Flow 16: "the cheaper one" -> Inspiron 15 (₹48,999)
  console.log('\n--- Flow 16: Comparative Price Selector ---');
  {
    const res = await generateAiResponse('the cheaper one', '', comparisonDellHistory, comparisonDellText);
    assert(res.reply.includes('Dell Inspiron 15 3530'), 'Flow 16: "the cheaper one" selects Dell Inspiron 15 3530 (₹48,999)');
  }

  // Flow 17: "its price" -> PRICE_QUERY
  console.log('\n--- Flow 17: Referential Price ---');
  {
    const r = detectIntentAndRequirements('its price', singleLenovoHistory, singleLenovoText);
    assert(r.intent === 'PRICE_QUERY' || r.intent === 'PRODUCT_RAG', 'Flow 17: "its price" -> PRICE_QUERY on active model');
  }

  // Flow 18: "its warranty" -> WARRANTY_QUERY
  console.log('\n--- Flow 18: Referential Warranty ---');
  {
    const r = detectIntentAndRequirements('its warranty', singleLenovoHistory, singleLenovoText);
    assert(r.intent === 'WARRANTY_QUERY', 'Flow 18: "its warranty" -> WARRANTY_QUERY on active model');
  }

  // Flow 19: "delivery details" -> DELIVERY_QUERY
  console.log('\n--- Flow 19: Delivery Policy ---');
  {
    const r = detectIntentAndRequirements('delivery details', '');
    assert(r.intent === 'DELIVERY_QUERY' && r.searchAllowed === false, 'Flow 19: "delivery details" -> DELIVERY_QUERY');
  }

  // Flow 20: "emi poecces" -> EMI_QUERY
  console.log('\n--- Flow 20: Typo EMI Policy ---');
  {
    const r = detectIntentAndRequirements('emi poecces', '');
    assert(r.intent === 'EMI_QUERY' && r.searchAllowed === false, 'Flow 20: "emi poecces" -> EMI_QUERY');
  }

  // Flow 21: "yes" with pending comparison offer -> PRODUCT_COMPARISON
  console.log('\n--- Flow 21: Contextual Yes Confirmation ---');
  {
    const promptWithCompareOffer = 'Here are Dell laptops.\n\nWould you like me to compare the Dell Inspiron 15 3530 and Dell Inspiron 14 5430?';
    const r = detectIntentAndRequirements('yes', '', promptWithCompareOffer);
    assert(r.intent === 'PRODUCT_COMPARISON', 'Flow 21: "yes" to compare offer executes PRODUCT_COMPARISON');
  }

  // Flow 22: "no" -> Rejection
  console.log('\n--- Flow 22: Denial / Rejection ---');
  {
    const r = detectIntentAndRequirements('no', '', 'Would you like me to compare these laptops?');
    assert(r.isDenial === true || r.intent === 'DENIAL', 'Flow 22: "no" rejects pending offer');
  }

  // Flow 23: "not Dell, Lenovo" -> Correction to Lenovo
  console.log('\n--- Flow 23: Direct Brand Correction ---');
  {
    const r = detectIntentAndRequirements('not Dell, Lenovo', comparisonDellHistory, comparisonDellText);
    assert(r.requirements.brand === 'Lenovo', 'Flow 23: "not Dell, Lenovo" sets brand to Lenovo');
  }

  // Flow 24: "start fresh" -> CONVERSATION_RESET
  console.log('\n--- Flow 24: Start Fresh Reset ---');
  {
    const r = detectIntentAndRequirements('start fresh', comparisonDellHistory, comparisonDellText);
    assert(r.intent === 'CONVERSATION_RESET', 'Flow 24: "start fresh" -> CONVERSATION_RESET');
  }

  // Flow 25: "show Lenovo laptops" -> Lenovo PRODUCT_SEARCH
  console.log('\n--- Flow 25: Explicit Search Request ---');
  {
    const r = detectIntentAndRequirements('show Lenovo laptops', '');
    assert(r.intent === 'PRODUCT_SEARCH' && r.requirements.brand === 'Lenovo' && r.searchAllowed === true, 'Flow 25: "show Lenovo laptops" -> Lenovo PRODUCT_SEARCH');
  }

  console.log('\n----------------------------------------------------------------');
  console.log(`Master Replay Matrix Summary: \x1b[32m${passed} Passed\x1b[0m, \x1b[31m${failed} Failed\x1b[0m`);
  console.log('----------------------------------------------------------------\n');

  if (failed > 0) process.exit(1);
}

runMasterProductionReplay();
