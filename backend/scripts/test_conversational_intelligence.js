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

async function runConversationalIntelligenceTests() {
  console.log('\n================================================================');
  console.log('🧪 RUNNING CONVERSATIONAL INTELLIGENCE & MULTI-TURN AUDIT SUITE');
  console.log('⚡ (Deep Reference Resolution, Ordinals, Selection, Context Priority)');
  console.log('================================================================\n');

  // Comparison context fixture
  const comparisonText = `Here is a side-by-side comparison between the *Dell Inspiron 15 3530* and *Dell Inspiron 14 5430*:

• *Price:* Dell Inspiron 15 3530 (₹48,999) vs Dell Inspiron 14 5430 (₹67,999) [Diff: ₹19,000]
• *RAM:* 8GB vs 16GB
• *Storage:* 512GB SSD vs 512GB SSD
• *Processor:* Intel Core i5 13th Gen vs Intel Core i5 13th Gen

Which of these two fits your requirements better?`;

  const comparisonHistory = `CUSTOMER: "compare Dell Inspiron 15 and Dell Inspiron 14"\nASSISTANT: "${comparisonText}"`;

  // Numbered product list fixture
  const productListText = `Here are our available *Dell* laptops:

1. *Dell Inspiron 15 3530* — *₹48,999*
   8GB RAM • 512GB SSD • Intel Core i5 13th Gen

2. *Dell Inspiron 14 5430* — *₹67,999*
   16GB RAM • 512GB SSD • Intel Core i5 13th Gen

3. *Dell Vostro 3520* — *₹44,999*
   16GB RAM • 512GB SSD • Intel Core i5 12th Gen

Would you like me to compare the *Dell Inspiron 15 3530* and *Dell Inspiron 14 5430*?`;

  const productListHistory = `CUSTOMER: "show Dell laptops"\nASSISTANT: "${productListText}"`;

  // Test 1-6: Ordinal & Option Selectors (1st one, first one, etc.)
  console.log('--- Test 1-6: Ordinal 1 Selection Variants ---');
  {
    const phrases = [
      '1st one',
      'first one',
      'the first one',
      'i think 1st one',
      'i think 1st one fits me well',
      'i prefer the first one'
    ];

    for (const phrase of phrases) {
      const res = await generateAiResponse(phrase, '', comparisonHistory, comparisonText);
      assert(
        res.reply.includes('Dell Inspiron 15 3530'),
        `"${phrase}" resolves to Dell Inspiron 15 3530`,
        `Reply: "${res.reply.slice(0, 60)}..."`
      );
      assert(res.responseSource === 'PRODUCT_CONTEXT', `"${phrase}" responseSource is PRODUCT_CONTEXT`, `Got: ${res.responseSource}`);
    }
  }

  // Test 7-10: Ordinal 2 Selection Variants
  console.log('\n--- Test 7-10: Ordinal 2 Selection Variants ---');
  {
    const phrases = [
      '2nd one',
      'second one',
      'the second one',
      'i think 2nd one fits me'
    ];

    for (const phrase of phrases) {
      const res = await generateAiResponse(phrase, '', comparisonHistory, comparisonText);
      assert(
        res.reply.includes('Dell Inspiron 14 5430'),
        `"${phrase}" resolves to Dell Inspiron 14 5430`,
        `Reply: "${res.reply.slice(0, 60)}..."`
      );
    }
  }

  // Test 11-13: Comparative & Alternate Selectors
  console.log('\n--- Test 11-13: Price & Alternate Selectors ---');
  {
    // "the cheaper one" between 48,999 and 67,999 -> Inspiron 15 (48,999)
    const resCheaper = await generateAiResponse('the cheaper one', '', comparisonHistory, comparisonText);
    assert(
      resCheaper.reply.includes('Dell Inspiron 15 3530'),
      '"the cheaper one" resolves to lowest price model (Dell Inspiron 15 3530)',
      `Reply: "${resCheaper.reply.slice(0, 60)}..."`
    );

    // "the other one" in comparison -> Inspiron 14
    const resOther = await generateAiResponse('the other one', '', comparisonHistory, comparisonText);
    assert(
      resOther.reply.includes('Dell Inspiron 14 5430'),
      '"the other one" resolves to alternate model (Dell Inspiron 14 5430)',
      `Reply: "${resOther.reply.slice(0, 60)}..."`
    );

    // "3rd one" in 3-product list -> Dell Vostro 3520
    const resThird = await generateAiResponse('3rd one', '', productListHistory, productListText);
    assert(
      resThird.reply.includes('Dell Vostro 3520'),
      '"3rd one" resolves to 3rd product in list (Dell Vostro 3520)',
      `Reply: "${resThird.reply.slice(0, 60)}..."`
    );
  }

  // Test 14: EXACT LIVE PRODUCTION FAILURE SCENARIO
  console.log('\n--- Test 14: EXACT LIVE PRODUCTION FAILURE SCENARIO ---');
  {
    // Turn 1: Assistant shows comparison
    // Turn 2: Customer says "hp"
    const turn2History = `${comparisonHistory}\nCUSTOMER: "hp"`;
    const resTurn2 = await generateAiResponse('hp', '', comparisonHistory, comparisonText);
    assert(
      resTurn2.reply.toLowerCase().includes('hp') && (resTurn2.reply.toLowerCase().includes('compare') || resTurn2.reply.toLowerCase().includes('search')),
      'Turn 2: "hp" asks contextual question to compare or search HP',
      `Reply: "${resTurn2.reply}"`
    );

    // Turn 3: Customer says "i think 1st one"
    const turn3History = `${turn2History}\nASSISTANT: "${resTurn2.reply}"`;
    const resTurn3 = await generateAiResponse('i think 1st one', '', turn3History, resTurn2.reply);
    assert(
      resTurn3.reply.includes('Dell Inspiron 15 3530'),
      'Turn 3: "i think 1st one" resolves to Dell Inspiron 15 3530 across multi-turn history',
      `Reply: "${resTurn3.reply}"`
    );
    assert(
      !resTurn3.reply.includes('Could you clarify what you\'re looking for'),
      'Turn 3: Does NOT return generic clarification loop',
      `Got: "${resTurn3.reply}"`
    );

    // Turn 4: Customer says "i think 1st one fits me well"
    const turn4History = `${turn3History}\nCUSTOMER: "i think 1st one fits me well"`;
    const resTurn4 = await generateAiResponse('i think 1st one fits me well', '', turn4History, resTurn3.reply);
    assert(
      resTurn4.reply.includes('Dell Inspiron 15 3530'),
      'Turn 4: "i think 1st one fits me well" confirms Dell Inspiron 15 3530',
      `Reply: "${resTurn4.reply}"`
    );
  }

  // Test 15-18: Multi-Turn End-to-End Flow & Reset Isolation
  console.log('\n--- Test 15-18: Multi-Turn End-to-End Flow & Reset Isolation ---');
  {
    // 1. Reset
    const rReset = detectIntentAndRequirements('forget everything', 'CUSTOMER: "HP laptops under 50000"');
    assert(rReset.intent === 'CONVERSATION_RESET', 'Step 1: "forget everything" -> CONVERSATION_RESET');

    // 2. Fresh Search
    const historyAfterReset = 'CUSTOMER: "forget everything"\nASSISTANT: "Sure — I\'ve cleared the previous conversation context. What would you like help with?"';
    const rDell = detectIntentAndRequirements('show Dell laptops under 60000', historyAfterReset);
    assert(rDell.intent === 'PRODUCT_SEARCH' && rDell.requirements.brand === 'Dell', 'Step 2: Fresh Dell search (no HP leakage)');

    // 3. Selection -> "first one"
    const dellResultsText = `Here are the *Dell* laptops under *₹60,000*:\n\n1. *Dell Vostro 3520* — *₹44,999*\n   16GB RAM • 512GB SSD • Intel Core i5 12th Gen\n\n2. *Dell Inspiron 15 3530* — *₹48,999*\n   8GB RAM • 512GB SSD • Intel Core i5 13th Gen\n\nWould you like me to compare the *Dell Vostro 3520* and *Dell Inspiron 15 3530*?`;
    const historyDell = `${historyAfterReset}\nCUSTOMER: "show Dell laptops under 60000"\nASSISTANT: "${dellResultsText}"`;
    const resSelect = await generateAiResponse('first one', '', historyDell, dellResultsText);
    assert(resSelect.reply.includes('Dell Vostro 3520'), 'Step 3: "first one" selects Dell Vostro 3520');

    // 4. Reset then "first one" -> No product to select
    const historyReset2 = `${historyDell}\nCUSTOMER: "forget everything"\nASSISTANT: "Sure — I\'ve cleared the previous conversation context. What would you like help with?"`;
    const rAfterReset2 = detectIntentAndRequirements('first one', historyReset2, 'Sure — I\'ve cleared the previous conversation context. What would you like help with?');
    assert(rAfterReset2.intent !== 'PRODUCT_SELECTION', 'Step 4: "first one" after reset does NOT select old product', `Got intent: ${rAfterReset2.intent}`);
  }

  console.log('\n----------------------------------------------------------------');
  console.log(`Conversational Intelligence Summary: \x1b[32m${passed} Passed\x1b[0m, \x1b[31m${failed} Failed\x1b[0m`);
  console.log('----------------------------------------------------------------\n');

  if (failed > 0) process.exit(1);
}

runConversationalIntelligenceTests();
