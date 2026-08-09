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

async function runAdversarialSuite() {
  console.log('\n================================================================');
  console.log('🧪 RUNNING PRODUCTION ADVERSARIAL & MULTI-TURN MATRIX SUITE');
  console.log('⚡ (Deep Validation of Scenarios A-AV & Adversarial Combinations)');
  console.log('================================================================\n');

  // Shared Fixtures
  const lenovoSingleText = 'Here is the *Lenovo IdeaPad Slim 3* — *₹38,999*\n   8GB RAM • 512GB SSD • Intel Core i3 13th Gen\n\nWould you like me to check warranty details for the Lenovo IdeaPad Slim 3?';
  const lenovoHistory = `CUSTOMER: "show Lenovo under 50000"\nASSISTANT: "${lenovoSingleText}"`;

  const comparisonDellText = `Here is a side-by-side comparison between the *Dell Inspiron 15 3530* and *Dell Inspiron 14 5430*:

• *Price:* Dell Inspiron 15 3530 (₹48,999) vs Dell Inspiron 14 5430 (₹67,999) [Diff: ₹19,000]
• *RAM:* 8GB vs 16GB
• *Storage:* 512GB SSD vs 512GB SSD

Which of these two fits your requirements better?`;
  const comparisonDellHistory = `CUSTOMER: "compare Dell Inspiron 15 and Dell Inspiron 14"\nASSISTANT: "${comparisonDellText}"`;

  // 1. Reset -> New Search
  console.log('--- Category 1: Reset & Context Isolation ---');
  {
    const r1 = detectIntentAndRequirements('forget everything', lenovoHistory, lenovoSingleText);
    assert(r1.intent === 'CONVERSATION_RESET', 'A: "forget everything" -> CONVERSATION_RESET');

    const historyAfterReset = `${lenovoHistory}\nCUSTOMER: "forget everything"\nASSISTANT: "Sure — I've cleared the previous conversation context."`;
    const r2 = detectIntentAndRequirements('show Dell laptops under 60000', historyAfterReset);
    assert(r2.intent === 'PRODUCT_SEARCH' && r2.requirements.brand === 'Dell', 'A: Fresh Dell search after reset (no Lenovo leakage)');
  }

  // 2. Brand & Language Typos
  console.log('\n--- Category 2: Typos & Shorthand Normalization ---');
  {
    const rTypo1 = detectIntentAndRequirements('del lapotp under 60k', '');
    assert(rTypo1.intent === 'PRODUCT_SEARCH' && rTypo1.requirements.brand === 'Dell' && rTypo1.requirements.maxPrice === 60000, 'B/C: "del lapotp under 60k" -> Dell, ₹60,000');

    const rTypo2 = detectIntentAndRequirements('lenevo laptop 16gb', '');
    assert(rTypo2.intent === 'PRODUCT_SEARCH' && rTypo2.requirements.brand === 'Lenovo' && rTypo2.requirements.ram === '16GB', 'C: "lenevo laptop 16gb" -> Lenovo, 16GB RAM');

    const rTypo3 = detectIntentAndRequirements('asuss vivobook', '');
    assert(rTypo3.intent === 'PRODUCT_SEARCH' && rTypo3.requirements.brand === 'ASUS', 'C: "asuss vivobook" -> ASUS');
  }

  // 3. Ordinals & Selections
  console.log('\n--- Category 3: Ordinal & Comparative Selection ---');
  {
    const res1 = await generateAiResponse('first one', '', comparisonDellHistory, comparisonDellText);
    assert(res1.reply.includes('Dell Inspiron 15 3530'), 'D/F: "first one" selects Dell Inspiron 15 3530');

    const res2 = await generateAiResponse('second one', '', comparisonDellHistory, comparisonDellText);
    assert(res2.reply.includes('Dell Inspiron 14 5430'), 'E: "second one" selects Dell Inspiron 14 5430');

    const resCheaper = await generateAiResponse('the cheaper one', '', comparisonDellHistory, comparisonDellText);
    assert(resCheaper.reply.includes('Dell Inspiron 15 3530'), 'G: "the cheaper one" selects Dell Inspiron 15 3530 (₹48,999)');

    const resOther = await generateAiResponse('the other one', '', comparisonDellHistory, comparisonDellText);
    assert(resOther.reply.includes('Dell Inspiron 14 5430'), 'H: "the other one" selects Dell Inspiron 14 5430');

    const resFits = await generateAiResponse('first one fits me', '', comparisonDellHistory, comparisonDellText);
    assert(resFits.reply.includes('Dell Inspiron 15 3530'), 'AC: "first one fits me" selects Dell Inspiron 15 3530');

    const resBetter = await generateAiResponse('I think first one is better', '', comparisonDellHistory, comparisonDellText);
    assert(resBetter.reply.includes('Dell Inspiron 15 3530'), 'AD: "I think first one is better" selects Dell Inspiron 15 3530');
  }

  // 4. Policy vs Product Transitions
  console.log('\n--- Category 4: Policy & Topic Transitions ---');
  {
    const rDelivery = detectIntentAndRequirements('what is delivery time', comparisonDellHistory, comparisonDellText);
    assert(rDelivery.intent === 'DELIVERY_QUERY' && rDelivery.searchAllowed === false, 'L/M: "what is delivery time" -> DELIVERY_QUERY (searchAllowed=false)');

    const rReturn = detectIntentAndRequirements('retun policy', '');
    assert(rReturn.intent === 'RETURN_POLICY' && rReturn.searchAllowed === false, 'Policy typo "retun policy" -> RETURN_POLICY');

    const rEmi = detectIntentAndRequirements('emi poecces', '');
    assert(rEmi.intent === 'EMI_QUERY' && rEmi.searchAllowed === false, 'AU: "emi poecces" -> EMI_QUERY');
  }

  // 5. Conversational Complaints & Feedback (No Product Search)
  console.log('\n--- Category 5: Conversational Complaints & Safety Gates ---');
  {
    const rComp1 = detectIntentAndRequirements('why did you show Dell?', comparisonDellHistory, comparisonDellText);
    assert(rComp1.intent === 'CLARIFICATION' && rComp1.searchAllowed === false, 'AI: "why did you show Dell?" -> CLARIFICATION');

    const rComp2 = detectIntentAndRequirements('I didn\'t ask for Dell', comparisonDellHistory, comparisonDellText);
    assert(rComp2.intent === 'CLARIFICATION' && rComp2.searchAllowed === false, 'AJ: "I didn\'t ask for Dell" -> CLARIFICATION');

    const rComp3 = detectIntentAndRequirements('what are you doing?', comparisonDellHistory, comparisonDellText);
    assert(rComp3.intent === 'CLARIFICATION' && rComp3.searchAllowed === false, 'AK: "what are you doing?" -> CLARIFICATION');

    const rBrandOnly = detectIntentAndRequirements('dell', '');
    assert(rBrandOnly.intent === 'CLARIFICATION' && rBrandOnly.searchAllowed === false, 'AO: Standalone "dell" -> CLARIFICATION (searchAllowed=false)');

    const rWhatAbout = detectIntentAndRequirements('what about dell?', lenovoHistory, lenovoSingleText);
    assert(rWhatAbout.intent === 'CLARIFICATION' && rWhatAbout.searchAllowed === false, 'AP: "what about dell?" -> CLARIFICATION');
  }

  // 6. Hinglish Support
  console.log('\n--- Category 6: Hinglish Language Understanding ---');
  {
    const rHing1 = detectIntentAndRequirements('dell ka laptop dikhao', '');
    assert(rHing1.intent === 'PRODUCT_SEARCH' && rHing1.requirements.brand === 'Dell', 'Hinglish: "dell ka laptop dikhao" -> Dell PRODUCT_SEARCH');

    const rHing2 = detectIntentAndRequirements('kitne din me delivery hogi', '');
    assert(rHing2.intent === 'DELIVERY_QUERY' && rHing2.searchAllowed === false, 'Hinglish: "kitne din me delivery hogi" -> DELIVERY_QUERY');

    const resHing3 = await generateAiResponse('pehla wala', '', comparisonDellHistory, comparisonDellText);
    assert(resHing3.reply.includes('Dell Inspiron 15 3530'), 'Hinglish: "pehla wala" selects first product');
  }

  // 7. Adversarial Combinations
  console.log('\n--- Category 7: Adversarial Combinations ---');
  {
    // "not lenovo first dell one"
    const rAdv1 = detectIntentAndRequirements('not lenovo, show dell laptop', lenovoHistory, lenovoSingleText);
    assert(rAdv1.intent === 'PRODUCT_SEARCH' && rAdv1.requirements.brand === 'Dell', 'Adversarial: "not lenovo, show dell laptop" -> Dell');

    // "forget everything what about first one" -> reset
    const rAdv2 = detectIntentAndRequirements('forget everything', comparisonDellHistory, comparisonDellText);
    assert(rAdv2.intent === 'CONVERSATION_RESET', 'Adversarial: "forget everything" executes CONVERSATION_RESET');

    // "what about the other one?"
    const resAdv3 = await generateAiResponse('what about the other one?', '', comparisonDellHistory, comparisonDellText);
    assert(resAdv3.reply.includes('Dell Inspiron 14 5430'), 'Adversarial: "what about the other one?" selects alternate model');
  }

  console.log('\n----------------------------------------------------------------');
  console.log(`Adversarial Matrix Summary: \x1b[32m${passed} Passed\x1b[0m, \x1b[31m${failed} Failed\x1b[0m`);
  console.log('----------------------------------------------------------------\n');

  if (failed > 0) process.exit(1);
}

runAdversarialSuite();
