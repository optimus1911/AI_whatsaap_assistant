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

async function runHardenedMatrix() {
  console.log('\n================================================================');
  console.log('🧪 RUNNING HARDENED 10 SCENARIOS (A through J) & EMOTIONAL AUDIT');
  console.log('⚡ (Deep Validation of Real-World Multi-Turn Customer Sessions)');
  console.log('================================================================\n');

  // Shared Multi-Product List
  const twoDellText = `Here are top Dell laptops:

1. *Dell Inspiron 15 3530* — *₹48,999*
   8GB RAM • 512GB SSD • Intel Core i5 13th Gen

2. *Dell Inspiron 14 5430* — *₹67,999*
   16GB RAM • 512GB SSD • Intel Core i5 13th Gen`;
  const twoDellHistory = `CUSTOMER: "show Dell laptops"\nASSISTANT: "${twoDellText}"`;

  // SCENARIO A: Natural Flow
  console.log('--- SCENARIO A: Search -> Selection -> Attributes -> Warranty ---');
  {
    const rA1 = detectIntentAndRequirements('hi', '');
    assert(rA1.intent === 'GREETING' && rA1.searchAllowed === false, 'Scenario A.1: "hi" -> GREETING');

    const rA2 = detectIntentAndRequirements('show Dell laptops under 60000', '');
    assert(rA2.intent === 'PRODUCT_SEARCH' && rA2.requirements.brand === 'Dell' && rA2.requirements.maxPrice === 60000, 'Scenario A.2: Dell search under ₹60,000');

    const resA3 = await generateAiResponse('the first one', '', twoDellHistory, twoDellText);
    assert(resA3.reply.includes('Dell Inspiron 15 3530'), 'Scenario A.3: "the first one" selects Option 1');

    const histA3 = `${twoDellHistory}\nCUSTOMER: "the first one"\nASSISTANT: "${resA3.reply}"`;
    const rA4 = detectIntentAndRequirements('how much RAM?', histA3, resA3.reply);
    assert(rA4.intent === 'ATTRIBUTE_QUERY', 'Scenario A.4: "how much RAM?" -> ATTRIBUTE_QUERY');

    const rA5 = detectIntentAndRequirements('is it available?', histA3, resA3.reply);
    assert(rA5.intent === 'AVAILABILITY_QUERY', 'Scenario A.5: "is it available?" -> AVAILABILITY_QUERY');

    const rA6 = detectIntentAndRequirements('what about warranty?', histA3, resA3.reply);
    assert(rA6.intent === 'WARRANTY_QUERY', 'Scenario A.6: "what about warranty?" -> WARRANTY_QUERY');
  }

  // SCENARIO B: Brand Correction + RAM Constraint Preservation + Cheaper Selector
  console.log('\n--- SCENARIO B: Brand Correction & Constraint Preservation ---');
  {
    const lenovoHist = `CUSTOMER: "show Lenovo under 60000"\nASSISTANT: "Here is Lenovo IdeaPad Slim 3"`;
    const rB1 = detectIntentAndRequirements('actually Dell', lenovoHist);
    assert(rB1.requirements.brand === 'Dell' && rB1.requirements.maxPrice === 60000, 'Scenario B.1: "actually Dell" preserves ₹60,000');

    const histB2 = `${lenovoHist}\nCUSTOMER: "actually Dell"\nCUSTOMER: "16GB"`;
    const rB2 = detectIntentAndRequirements('16GB', histB2);
    assert(rB2.requirements.ram === '16GB' && rB2.requirements.brand === 'Dell', 'Scenario B.2: Adds 16GB RAM constraint to Dell');

    const resB3 = await generateAiResponse('which one is cheaper?', '', twoDellHistory, twoDellText);
    assert(resB3.reply.includes('Dell Inspiron 15 3530'), 'Scenario B.3: "which one is cheaper?" selects ₹48,999 model');

    const resB4 = await generateAiResponse('the second one', '', twoDellHistory, twoDellText);
    assert(resB4.reply.includes('Dell Inspiron 14 5430'), 'Scenario B.4: "the second one" selects option 2');
  }

  // SCENARIO C: Comparison -> Selection -> Price -> Availability
  console.log('\n--- SCENARIO C: Comparison -> Selection -> Price -> Availability ---');
  {
    const dellHpText = `1. *Dell Inspiron 15 3530* — *₹48,999*\n2. *HP 15s* — *₹42,999*`;
    const histC = `CUSTOMER: "show Dell and HP"\nASSISTANT: "${dellHpText}"`;
    const rC1 = detectIntentAndRequirements('the Dell one', histC, dellHpText);
    assert(rC1.intent === 'PRODUCT_SELECTION' && rC1.requirements.mentionedModels.some(m => m.includes('Dell')), 'Scenario C.1: "the Dell one" selects Dell model');

    const resC1 = await generateAiResponse('the Dell one', '', histC, dellHpText);
    const histC2 = `${histC}\nCUSTOMER: "the Dell one"\nASSISTANT: "${resC1.reply}"`;
    const rC2 = detectIntentAndRequirements('how much?', histC2, resC1.reply);
    assert(rC2.intent === 'PRICE_QUERY', 'Scenario C.2: "how much?" -> PRICE_QUERY');

    const rC3 = detectIntentAndRequirements('is it available?', histC2, resC1.reply);
    assert(rC3.intent === 'AVAILABILITY_QUERY', 'Scenario C.3: "is it available?" -> AVAILABILITY_QUERY');
  }

  // SCENARIO D: Search -> Policy -> Delivery -> Active Product Spec Selection
  console.log('\n--- SCENARIO D: Policy Isolation & Return to Product Spec ---');
  {
    const histD = `${twoDellHistory}\nCUSTOMER: "what is the return policy?"\nASSISTANT: "We offer 7-day hassle-free replacement."\nCUSTOMER: "and delivery?"\nASSISTANT: "Standard doorstep delivery takes 3-7 business days."`;
    const rD1 = detectIntentAndRequirements('which one has 16GB?', histD, 'Standard doorstep delivery takes 3-7 business days.');
    assert(rD1.intent === 'PRODUCT_SELECTION' && rD1.requirements.mentionedModels.some(m => m.includes('Inspiron 14')), 'Scenario D: "which one has 16GB?" identifies Dell Inspiron 14');
  }

  // SCENARIO E: Reset -> Fresh Asus -> "what about Dell?" (Clarification)
  console.log('\n--- SCENARIO E: Reset Isolation & Ambiguity Gating ---');
  {
    const histE = `CUSTOMER: "forget everything"\nASSISTANT: "Sure — I've cleared the previous conversation context."\nCUSTOMER: "hi"\nASSISTANT: "Hello! How can I help?"\nCUSTOMER: "show Asus laptops"\nASSISTANT: "Here is ASUS Vivobook 15."`;
    const rE1 = detectIntentAndRequirements('what about Dell?', histE, 'Here is ASUS Vivobook 15.');
    assert(rE1.intent === 'CLARIFICATION' && rE1.searchAllowed === false, 'Scenario E: "what about Dell?" is CLARIFICATION (no product search)');
  }

  // SCENARIO F: Brand Correction -> "same budget" -> "show me 16GB"
  console.log('\n--- SCENARIO F: Correction + "same budget" ---');
  {
    const histF = `CUSTOMER: "show Lenovo under 50000"\nASSISTANT: "Here are Lenovo laptops under ₹50,000"\nCUSTOMER: "no I meant Dell"\nCUSTOMER: "same budget"`;
    const rF1 = detectIntentAndRequirements('show me 16GB', histF);
    assert(rF1.requirements.brand === 'Dell' && rF1.requirements.maxPrice === 50000 && rF1.requirements.ram === '16GB', 'Scenario F: Preserves Dell + ₹50,000 budget + 16GB RAM');
  }

  // SCENARIO G: Typo search -> "yes" -> "the cheaper one"
  console.log('\n--- SCENARIO G: Typo search + Cheaper Selector ---');
  {
    const rG1 = detectIntentAndRequirements('del laptop under 60k', '');
    assert(rG1.intent === 'PRODUCT_SEARCH' && rG1.requirements.brand === 'Dell' && rG1.requirements.maxPrice === 60000, 'Scenario G.1: "del laptop under 60k" -> Dell, ₹60,000');

    const resG2 = await generateAiResponse('the cheaper one', '', twoDellHistory, twoDellText);
    assert(resG2.reply.includes('Dell Inspiron 15 3530'), 'Scenario G.2: "the cheaper one" selects ₹48,999 model');
  }

  // SCENARIO H: Frustrated Customer Feedback (Zero Product Search)
  console.log('\n--- SCENARIO H: Emotional / Frustrated Feedback ---');
  {
    const rH1 = detectIntentAndRequirements('why did you show Dell?', twoDellHistory, twoDellText);
    assert(rH1.intent === 'CLARIFICATION' && rH1.searchAllowed === false, 'Scenario H.1: "why did you show Dell?" -> CLARIFICATION');

    const rH2 = detectIntentAndRequirements('that\'s not what I asked', twoDellHistory, twoDellText);
    assert(rH2.intent === 'CLARIFICATION' && rH2.searchAllowed === false, 'Scenario H.2: "that\'s not what I asked" -> CLARIFICATION');

    const rH3 = detectIntentAndRequirements('listen to what I\'m saying', twoDellHistory, twoDellText);
    assert(rH3.intent === 'CLARIFICATION' && rH3.searchAllowed === false, 'Scenario H.3: "listen to what I\'m saying" -> CLARIFICATION');
  }

  // SCENARIO I: Sequence of selections ("first one" -> "actually second one" -> "no, the other one")
  console.log('\n--- SCENARIO I: Selection State Transitions ---');
  {
    const resI1 = await generateAiResponse('first one', '', twoDellHistory, twoDellText);
    assert(resI1.reply.includes('Dell Inspiron 15 3530'), 'Scenario I.1: "first one" -> Option 1');

    const resI2 = await generateAiResponse('actually second one', '', twoDellHistory, twoDellText);
    assert(resI2.reply.includes('Dell Inspiron 14 5430'), 'Scenario I.2: "actually second one" -> Option 2');

    const resI3 = await generateAiResponse('no, the other one', '', twoDellHistory, twoDellText);
    assert(resI3.reply.includes('Dell Inspiron 14 5430') || resI3.reply.includes('Dell Inspiron 15'), 'Scenario I.3: "no, the other one" selects alternate option');
  }

  // SCENARIO J: "what about the other one?" when only 1 entity exists (Clarify, No Hallucination)
  console.log('\n--- SCENARIO J: Alternate Request with 1 Product (No Hallucination) ---');
  {
    const singleProduct = 'Here is the *Dell Inspiron 15 3530* — *₹48,999*';
    const histJ = `CUSTOMER: "show Dell"\nASSISTANT: "${singleProduct}"`;
    const rJ1 = detectIntentAndRequirements('what about the other one?', histJ, singleProduct);
    assert(rJ1.intent === 'CLARIFICATION' && rJ1.searchAllowed === false, 'Scenario J: "what about the other one?" with 1 product asks clarification');
  }

  console.log('\n----------------------------------------------------------------');
  console.log(`Hardened Dialogue Matrix Summary: \x1b[32m${passed} Passed\x1b[0m, \x1b[31m${failed} Failed\x1b[0m`);
  console.log('----------------------------------------------------------------\n');

  if (failed > 0) process.exit(1);
}

runHardenedMatrix();
