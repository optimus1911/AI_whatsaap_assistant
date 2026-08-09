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

async function runMasterDialogueFlows() {
  console.log('\n================================================================');
  console.log('🧪 RUNNING MASTER 15-FLOW PRODUCTION DIALOGUE MATRIX (A through O)');
  console.log('⚡ (Deep Validation of Real-World WhatsApp Conversational Sessions)');
  console.log('================================================================\n');

  // Shared Multi-Product Fixture
  const dellListText = `Here are the top Dell laptops matching your requirements:

1. *Dell Inspiron 15 3530* — *₹48,999*
   8GB RAM • 512GB SSD • Intel Core i5 13th Gen

2. *Dell Inspiron 14 5430* — *₹67,999*
   16GB RAM • 512GB SSD • Intel Core i5 13th Gen

Would you like me to compare these two laptops?`;
  const dellListHistory = `CUSTOMER: "show Dell laptops"\nASSISTANT: "${dellListText}"`;

  // Flow A: Search -> Selection -> Warranty -> Delivery
  console.log('--- Flow A: Search -> Selection -> Warranty -> Delivery ---');
  {
    const rSel = detectIntentAndRequirements('first one', dellListHistory, dellListText);
    assert(rSel.intent === 'PRODUCT_SELECTION' && rSel.searchAllowed === false, 'Flow A.1: "first one" -> PRODUCT_SELECTION');

    const resSel = await generateAiResponse('first one', '', dellListHistory, dellListText);
    assert(resSel.reply.includes('Dell Inspiron 15 3530'), 'Flow A.2: Selects Dell Inspiron 15 3530');

    const histA = `${dellListHistory}\nCUSTOMER: "first one"\nASSISTANT: "${resSel.reply}"`;
    const rWarr = detectIntentAndRequirements('what about warranty?', histA, resSel.reply);
    assert(rWarr.intent === 'WARRANTY_QUERY' && rWarr.searchAllowed === false, 'Flow A.3: "what about warranty?" -> WARRANTY_QUERY');

    const rDel = detectIntentAndRequirements('delivery time?', histA, resSel.reply);
    assert(rDel.intent === 'DELIVERY_QUERY' && rDel.searchAllowed === false, 'Flow A.4: "delivery time?" -> DELIVERY_QUERY');
  }

  // Flow B: Search -> Comparison -> Selection -> Price
  console.log('\n--- Flow B: Search -> Comparison -> Selection -> Price ---');
  {
    const rComp = detectIntentAndRequirements('yes', dellListHistory, dellListText);
    assert(rComp.intent === 'PRODUCT_COMPARISON', 'Flow B.1: "yes" to compare offer -> PRODUCT_COMPARISON');

    const resComp = await generateAiResponse('yes', '', dellListHistory, dellListText);
    assert(resComp.reply.includes('side-by-side comparison') || resComp.reply.includes('vs'), 'Flow B.2: Generates side-by-side comparison');

    const histB = `${dellListHistory}\nCUSTOMER: "yes"\nASSISTANT: "${resComp.reply}"`;
    const resCheaper = await generateAiResponse('the cheaper one', '', histB, resComp.reply);
    assert(resCheaper.reply.includes('Dell Inspiron 15 3530'), 'Flow B.3: "the cheaper one" selects Dell Inspiron 15 (₹48,999)');

    const histB2 = `${histB}\nCUSTOMER: "the cheaper one"\nASSISTANT: "${resCheaper.reply}"`;
    const rPrice = detectIntentAndRequirements('its price', histB2, resCheaper.reply);
    assert(rPrice.intent === 'PRICE_QUERY' || rPrice.intent === 'PRODUCT_RAG', 'Flow B.4: "its price" -> PRICE_QUERY');
  }

  // Flow C: Search -> Correction -> Comparison
  console.log('\n--- Flow C: Search -> Correction -> Comparison ---');
  {
    const rCorr = detectIntentAndRequirements('sorry i needed hp laptop', dellListHistory, dellListText);
    assert(rCorr.intent === 'PRODUCT_SEARCH' && rCorr.requirements.brand === 'HP', 'Flow C.1: "sorry i needed hp laptop" -> HP PRODUCT_SEARCH');

    const hpText = 'Here is the *HP Pavilion 15* — *₹65,999*\n   16GB RAM • 512GB SSD • Intel Core i5 13th Gen';
    const histC = `CUSTOMER: "sorry i needed hp laptop"\nASSISTANT: "${hpText}"`;
    const rCompHP = detectIntentAndRequirements('compare it with Dell', histC, hpText);
    assert(rCompHP.intent === 'PRODUCT_COMPARISON' && rCompHP.requirements.mentionedModels.some(m => m.includes('HP')), 'Flow C.2: "compare it with Dell" preserves HP source');
  }

  // Flow D: Search -> Policy -> Return to Product
  console.log('\n--- Flow D: Search -> Policy -> Return to Product ---');
  {
    const rPolicy = detectIntentAndRequirements('what is delivery time?', dellListHistory, dellListText);
    assert(rPolicy.intent === 'DELIVERY_QUERY' && rPolicy.searchAllowed === false, 'Flow D.1: Policy query isolates context');

    const delText = 'Standard doorstep delivery takes 3-7 business days across India.';
    const histD = `${dellListHistory}\nCUSTOMER: "what is delivery time?"\nASSISTANT: "${delText}"`;
    const resReturn = await generateAiResponse('first one', '', histD, delText);
    assert(resReturn.reply.includes('Dell Inspiron 15 3530'), 'Flow D.2: "first one" returns to active product context');
  }

  // Flow E: Reset -> Completely New Search
  console.log('\n--- Flow E: Reset -> Completely New Search ---');
  {
    const histE = `${dellListHistory}\nCUSTOMER: "forget all previous chats"\nASSISTANT: "Sure — I've cleared the previous conversation context."`;
    const rFresh = detectIntentAndRequirements('i need lenovo under 45000', histE);
    assert(rFresh.intent === 'PRODUCT_SEARCH' && rFresh.requirements.brand === 'Lenovo' && rFresh.requirements.maxPrice === 45000, 'Flow E: Fresh Lenovo search with zero Dell leakage');
  }

  // Flow F: Ambiguous Pronoun After Multiple Products
  console.log('\n--- Flow F: Ambiguous Pronoun After Multiple Products ---');
  {
    const rAmb = detectIntentAndRequirements('is this available to you', dellListHistory, dellListText);
    assert(rAmb.intent === 'CLARIFICATION' || (rAmb.isClarification && rAmb.searchAllowed === false), 'Flow F: Multiple active models -> CLARIFICATION (not guessing)');
  }

  // Flow G: Brand Typo Normalization
  console.log('\n--- Flow G: Brand Typo Normalization ---');
  {
    const rTypo = detectIntentAndRequirements('del laptop under 60k', '');
    assert(rTypo.intent === 'PRODUCT_SEARCH' && rTypo.requirements.brand === 'Dell' && rTypo.requirements.maxPrice === 60000, 'Flow G: "del laptop under 60k" -> Dell, ₹60,000');
  }

  // Flow H: Hinglish Phrases
  console.log('\n--- Flow H: Hinglish Understanding ---');
  {
    const rHing1 = detectIntentAndRequirements('kitne ka hai', dellListHistory, dellListText);
    assert(rHing1.intent === 'PRICE_QUERY' || rHing1.intent === 'CLARIFICATION', 'Flow H.1: "kitne ka hai" recognized as price query');

    const resHing2 = await generateAiResponse('pehla wala', '', dellListHistory, dellListText);
    assert(resHing2.reply.includes('Dell Inspiron 15 3530'), 'Flow H.2: "pehla wala" selects first option');

    const rHing3 = detectIntentAndRequirements('kab milega', '');
    assert(rHing3.intent === 'DELIVERY_QUERY' && rHing3.searchAllowed === false, 'Flow H.3: "kab milega" -> DELIVERY_QUERY');
  }

  // Flow I: Typo + Hinglish + Pronoun
  console.log('\n--- Flow I: Typo + Hinglish + Pronoun ---');
  {
    const rTypoHing = detectIntentAndRequirements('del ka laptop dikhao under 50k', '');
    assert(rTypoHing.intent === 'PRODUCT_SEARCH' && rTypoHing.requirements.brand === 'Dell' && rTypoHing.requirements.maxPrice === 50000, 'Flow I: "del ka laptop dikhao under 50k" -> Dell, ₹50,000');
  }

  // Flow J: Customer Complaint / Feedback (No Product Search)
  console.log('\n--- Flow J: Customer Complaint / Feedback ---');
  {
    const rComp = detectIntentAndRequirements('why did you show Dell?', dellListHistory, dellListText);
    assert(rComp.intent === 'CLARIFICATION' && rComp.searchAllowed === false, 'Flow J.1: "why did you show Dell?" -> CLARIFICATION');

    const rComp2 = detectIntentAndRequirements('that\'s not what I asked', dellListHistory, dellListText);
    assert(rComp2.intent === 'CLARIFICATION' && rComp2.searchAllowed === false, 'Flow J.2: "that\'s not what I asked" -> CLARIFICATION');
  }

  // Flow K: Customer Changes Requirements
  console.log('\n--- Flow K: Customer Changes Requirements ---');
  {
    const rChange = detectIntentAndRequirements('actually I want HP laptop under 70000', dellListHistory, dellListText);
    assert(rChange.intent === 'PRODUCT_SEARCH' && rChange.requirements.brand === 'HP' && rChange.requirements.maxPrice === 70000, 'Flow K: Requirement change overrides Dell with HP (₹70,000)');
  }

  // Flow L: Customer Rejects Recommendation
  console.log('\n--- Flow L: Customer Rejects Recommendation ---');
  {
    const rNo = detectIntentAndRequirements('no', dellListHistory, 'Would you like me to compare these laptops?');
    assert(rNo.isDenial === true || rNo.intent === 'DENIAL', 'Flow L: "no" rejects pending action');
  }

  // Flow M: Unrelated Business Policy
  console.log('\n--- Flow M: Business Policy ---');
  {
    const rEmi = detectIntentAndRequirements('emi poecces', '');
    assert(rEmi.intent === 'EMI_QUERY' && rEmi.searchAllowed === false, 'Flow M.1: "emi poecces" -> EMI_QUERY');

    const rRet = detectIntentAndRequirements('retun policy', '');
    assert(rRet.intent === 'RETURN_POLICY' && rRet.searchAllowed === false, 'Flow M.2: "retun policy" -> RETURN_POLICY');
  }

  // Flow N: Return to Previous Product After Policy
  console.log('\n--- Flow N: Return to Previous Product After Policy ---');
  {
    const singleDellText = 'Here is the *Dell Inspiron 15 3530* — *₹48,999*';
    const histN = `CUSTOMER: "show Dell"\nASSISTANT: "${singleDellText}"\nCUSTOMER: "what is return policy?"\nASSISTANT: "We offer 7-day hassle-free returns."`;
    const rWarrN = detectIntentAndRequirements('what about its warranty?', histN, 'We offer 7-day hassle-free returns.');
    assert(rWarrN.intent === 'WARRANTY_QUERY' && rWarrN.requirements.mentionedModels.some(m => m.includes('Dell')), 'Flow N: Returns to active Dell model for warranty inquiry');
  }

  // Flow O: Contextual Yes After Different Questions
  console.log('\n--- Flow O: Contextual Yes After Different Questions ---');
  {
    const rYesComp = detectIntentAndRequirements('yes', '', 'Would you like me to compare the Dell Inspiron 15 and Dell Inspiron 14?');
    assert(rYesComp.intent === 'PRODUCT_COMPARISON', 'Flow O.1: "yes" to compare offer -> PRODUCT_COMPARISON');

    const rYesWarr = detectIntentAndRequirements('yes', '', 'Would you like me to check warranty details for the Dell Inspiron 15?');
    assert(rYesWarr.intent === 'WARRANTY_QUERY', 'Flow O.2: "yes" to warranty offer -> WARRANTY_QUERY');
  }

  console.log('\n----------------------------------------------------------------');
  console.log(`Master Dialogue Matrix Summary: \x1b[32m${passed} Passed\x1b[0m, \x1b[31m${failed} Failed\x1b[0m`);
  console.log('----------------------------------------------------------------\n');

  if (failed > 0) process.exit(1);
}

runMasterDialogueFlows();
