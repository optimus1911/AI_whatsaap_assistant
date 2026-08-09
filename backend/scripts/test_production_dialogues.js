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

async function runProductionDialogues() {
  console.log('\n================================================================');
  console.log('🧪 RUNNING PRODUCTION 18-TURN DIALOGUE & CASES A-L (SECTIONS 35 & 40)');
  console.log('⚡ (Deep Multi-Turn Continuous State & Invariant Verification)');
  console.log('================================================================\n');

  // ==========================================================
  // SECTION 35: REALISTIC 18-TURN CONTINUOUS CONVERSATION
  // ==========================================================
  console.log('--- SECTION 35: Realistic 18-Turn Continuous Dialogue ---');
  let history = '';
  let lastAssistantMsg = '';

  // Turn 1: hi
  {
    const r1 = detectIntentAndRequirements('hi', history, lastAssistantMsg);
    assert(r1.intent === 'GREETING' && r1.searchAllowed === false, 'Turn 1: "hi" -> GREETING (no search)');
    lastAssistantMsg = 'Hi! 👋 Welcome to AI WhatsApp Assistant. How can I help you today?';
    history += `CUSTOMER: "hi"\nASSISTANT: "${lastAssistantMsg}"\n`;
  }

  // Turn 2: I need a laptop
  {
    const r2 = detectIntentAndRequirements('I need a laptop', history, lastAssistantMsg);
    assert(r2.intent === 'PRODUCT_SEARCH' || r2.intent === 'CLARIFICATION', 'Turn 2: "I need a laptop" recognized as shopping discovery');
    lastAssistantMsg = 'Sure! Do you have a specific brand, price range, or use case in mind?';
    history += `CUSTOMER: "I need a laptop"\nASSISTANT: "${lastAssistantMsg}"\n`;
  }

  // Turn 3: under 60000
  {
    const r3 = detectIntentAndRequirements('under 60000', history, lastAssistantMsg);
    assert(r3.requirements.maxPrice === 60000, 'Turn 3: "under 60000" extracts budget ₹60,000');
    lastAssistantMsg = 'Got it, looking under ₹60,000. Any preferred brand or specs?';
    history += `CUSTOMER: "under 60000"\nASSISTANT: "${lastAssistantMsg}"\n`;
  }

  // Turn 4: 8gb ram
  {
    const r4 = detectIntentAndRequirements('8gb ram', history, lastAssistantMsg);
    assert(r4.requirements.ram === '8GB', 'Turn 4: "8gb ram" extracts 8GB RAM');
    lastAssistantMsg = 'Perfect, 8GB RAM under ₹60,000. Which brand do you prefer?';
    history += `CUSTOMER: "8gb ram"\nASSISTANT: "${lastAssistantMsg}"\n`;
  }

  // Turn 5: show Dell
  {
    const r5 = detectIntentAndRequirements('show Dell', history, lastAssistantMsg);
    assert(r5.intent === 'PRODUCT_SEARCH' && r5.requirements.brand === 'Dell', 'Turn 5: "show Dell" -> Dell PRODUCT_SEARCH');
    assert(r5.requirements.maxPrice === 60000 && r5.requirements.ram === '8GB', 'Turn 5: Preserves ₹60k and 8GB RAM constraints');
    lastAssistantMsg = `Here are the top Dell laptops matching your requirements:

1. *Dell Inspiron 15 3530* — *₹48,999*
   8GB RAM • 512GB SSD • Intel Core i5 13th Gen

2. *Dell Vostro 3520* — *₹54,999*
   8GB RAM • 512GB SSD • Intel Core i5 12th Gen

Would you like me to compare these two laptops?`;
    history += `CUSTOMER: "show Dell"\nASSISTANT: "${lastAssistantMsg}"\n`;
  }

  // Turn 6: first one
  {
    const r6 = detectIntentAndRequirements('first one', history, lastAssistantMsg);
    assert(r6.intent === 'PRODUCT_SELECTION' && r6.searchAllowed === false, 'Turn 6: "first one" -> PRODUCT_SELECTION');
    const res6 = await generateAiResponse('first one', '', history, lastAssistantMsg);
    assert(res6.reply.includes('Dell Inspiron 15 3530'), 'Turn 6: Selects Dell Inspiron 15 3530');
    lastAssistantMsg = res6.reply;
    history += `CUSTOMER: "first one"\nASSISTANT: "${lastAssistantMsg}"\n`;
  }

  // Turn 7: how much?
  {
    const r7 = detectIntentAndRequirements('how much?', history, lastAssistantMsg);
    assert(r7.intent === 'PRICE_QUERY' || r7.intent === 'PRODUCT_RAG', 'Turn 7: "how much?" -> PRICE_QUERY for active model');
    lastAssistantMsg = 'The Dell Inspiron 15 3530 is priced at ₹48,999.';
    history += `CUSTOMER: "how much?"\nASSISTANT: "${lastAssistantMsg}"\n`;
  }

  // Turn 8: warranty?
  {
    const r8 = detectIntentAndRequirements('warranty?', history, lastAssistantMsg);
    assert(r8.intent === 'WARRANTY_QUERY' && r8.searchAllowed === false, 'Turn 8: "warranty?" -> WARRANTY_QUERY for active model');
    lastAssistantMsg = 'The Dell Inspiron 15 3530 comes with 1 Year Onsite Manufacturer Warranty.';
    history += `CUSTOMER: "warranty?"\nASSISTANT: "${lastAssistantMsg}"\n`;
  }

  // Turn 9: compare it with Lenovo
  {
    const r9 = detectIntentAndRequirements('compare it with Lenovo', history, lastAssistantMsg);
    assert(r9.intent === 'PRODUCT_COMPARISON', 'Turn 9: "compare it with Lenovo" -> PRODUCT_COMPARISON');
    assert(r9.requirements.mentionedModels.some(m => m.includes('Dell')) && r9.requirements.mentionedModels.some(m => m.includes('Lenovo')), 'Turn 9: Compares active Dell with Lenovo candidate');
    lastAssistantMsg = `Here is a side-by-side comparison:

*Dell Inspiron 15 3530* vs *Lenovo IdeaPad Slim 3*:
- Price: ₹48,999 vs ₹38,999
- RAM: 8GB vs 8GB
- Processor: Intel i5 13th Gen vs Intel i3 13th Gen

The Lenovo IdeaPad Slim 3 is ₹10,000 cheaper, while the Dell offers faster i5 performance.`;
    history += `CUSTOMER: "compare it with Lenovo"\nASSISTANT: "${lastAssistantMsg}"\n`;
  }

  // Turn 10: which is cheaper?
  {
    const res10 = await generateAiResponse('which is cheaper?', '', history, lastAssistantMsg);
    assert(res10.reply.includes('Lenovo IdeaPad Slim 3') || res10.reply.includes('Dell Inspiron 15'), 'Turn 10: "which is cheaper?" evaluates comparative pricing');
    lastAssistantMsg = 'The Lenovo IdeaPad Slim 3 is cheaper at ₹38,999 compared to the Dell Inspiron 15 at ₹48,999.';
    history += `CUSTOMER: "which is cheaper?"\nASSISTANT: "${lastAssistantMsg}"\n`;
  }

  // Turn 11: actually forget that
  {
    const r11 = detectIntentAndRequirements('actually forget that', history, lastAssistantMsg);
    assert(r11.intent === 'CLARIFICATION' || r11.searchAllowed === false, 'Turn 11: "actually forget that" -> Clears comparison focus');
    lastAssistantMsg = 'No problem! What would you like to explore next?';
    history += `CUSTOMER: "actually forget that"\nASSISTANT: "${lastAssistantMsg}"\n`;
  }

  // Turn 12: show HP
  {
    const r12 = detectIntentAndRequirements('show HP', history, lastAssistantMsg);
    assert(r12.intent === 'PRODUCT_SEARCH' && r12.requirements.brand === 'HP', 'Turn 12: "show HP" -> HP PRODUCT_SEARCH');
    lastAssistantMsg = 'Here are our HP laptops: HP 15s (₹42,999) and HP Pavilion 15 (₹65,999).';
    history += `CUSTOMER: "show HP"\nASSISTANT: "${lastAssistantMsg}"\n`;
  }

  // Turn 13: under 50000
  {
    const r13 = detectIntentAndRequirements('under 50000', history, lastAssistantMsg);
    assert(r13.requirements.maxPrice === 50000 && r13.requirements.brand === 'HP', 'Turn 13: Sets HP under ₹50,000');
    lastAssistantMsg = `Here are the top HP laptops matching your requirements:

1. *HP 15s* — *₹42,999*
   8GB RAM • 512GB SSD • AMD Ryzen 5 5500U

2. *HP ProBook 440 G10* — *₹48,999*
   8GB RAM • 512GB SSD • Intel Core i5 13th Gen`;
    history += `CUSTOMER: "under 50000"\nASSISTANT: "${lastAssistantMsg}"\n`;
  }

  // Turn 14: delivery time?
  {
    const r14 = detectIntentAndRequirements('delivery time?', history, lastAssistantMsg);
    assert(r14.intent === 'DELIVERY_QUERY' && r14.searchAllowed === false, 'Turn 14: "delivery time?" -> DELIVERY_QUERY (BUSINESS_RAG)');
    lastAssistantMsg = 'Standard doorstep delivery takes 3 to 7 business days across India.';
    history += `CUSTOMER: "delivery time?"\nASSISTANT: "${lastAssistantMsg}"\n`;
  }

  // Turn 15: what about returns?
  {
    const r15 = detectIntentAndRequirements('what about returns?', history, lastAssistantMsg);
    assert(r15.intent === 'RETURN_POLICY' && r15.searchAllowed === false, 'Turn 15: "what about returns?" -> RETURN_POLICY (BUSINESS_RAG)');
    lastAssistantMsg = 'We offer a 7-day hassle-free replacement or return policy for defective/damaged units.';
    history += `CUSTOMER: "what about returns?"\nASSISTANT: "${lastAssistantMsg}"\n`;
  }

  // Turn 16: show the second one
  {
    const res16 = await generateAiResponse('show the second one', '', history, lastAssistantMsg);
    assert(res16.reply.includes('HP ProBook 440 G10') || res16.reply.includes('ProBook'), 'Turn 16: "show the second one" selects HP ProBook 440 G10');
    lastAssistantMsg = res16.reply;
    history += `CUSTOMER: "show the second one"\nASSISTANT: "${lastAssistantMsg}"\n`;
  }

  // Turn 17: is it available?
  {
    const r17 = detectIntentAndRequirements('is it available?', history, lastAssistantMsg);
    assert(r17.intent === 'AVAILABILITY_QUERY' && r17.searchAllowed === false, 'Turn 17: "is it available?" -> AVAILABILITY_QUERY for HP ProBook');
    lastAssistantMsg = 'Yes, the HP ProBook 440 G10 is in stock and ready to ship!';
    history += `CUSTOMER: "is it available?"\nASSISTANT: "${lastAssistantMsg}"\n`;
  }

  // Turn 18: thanks
  {
    const r18 = detectIntentAndRequirements('thanks', history, lastAssistantMsg);
    assert(r18.searchAllowed === false, 'Turn 18: "thanks" does NOT search products');
  }

  // ==========================================================
  // SECTION 40: CASES A THROUGH L VALIDATION
  // ==========================================================
  console.log('\n--- SECTION 40: Acceptance Cases A through L ---');

  // Case A: Natural search -> Selection -> Price -> Warranty
  {
    const dellList = `Here are the top Dell laptops matching your requirements:

1. *Dell Inspiron 15 3530* — *₹48,999*
   8GB RAM • 512GB SSD • Intel Core i5 13th Gen

2. *Dell Inspiron 14 5430* — *₹67,999*
   16GB RAM • 512GB SSD • Intel Core i5 13th Gen`;
    const histA = `CUSTOMER: "i need a laptop under 60000"\nASSISTANT: "Any preferred brand?"\nCUSTOMER: "del"\nASSISTANT: "${dellList}"`;
    const resA1 = await generateAiResponse('first one', '', histA, dellList);
    assert(resA1.reply.includes('Dell Inspiron 15 3530'), 'Case A.1: "first one" selects Dell Inspiron 15');

    const histA2 = `${histA}\nCUSTOMER: "first one"\nASSISTANT: "${resA1.reply}"`;
    const rA2 = detectIntentAndRequirements('its price?', histA2, resA1.reply);
    assert(rA2.intent === 'PRICE_QUERY' || rA2.intent === 'PRODUCT_RAG', 'Case A.2: "its price?" -> PRICE_QUERY');

    const rA3 = detectIntentAndRequirements('warranty?', histA2, resA1.reply);
    assert(rA3.intent === 'WARRANTY_QUERY', 'Case A.3: "warranty?" -> WARRANTY_QUERY');
  }

  // Case B: Lenovo -> compare it with Dell
  {
    const lenovoSingle = 'Here is the *Lenovo IdeaPad Slim 3* — *₹38,999*';
    const histB = `CUSTOMER: "show Lenovo laptops"\nASSISTANT: "${lenovoSingle}"`;
    const rB = detectIntentAndRequirements('compare it with Dell', histB, lenovoSingle);
    assert(rB.intent === 'PRODUCT_COMPARISON', 'Case B: Lenovo vs Dell comparison (not HP vs HP)');
  }

  // Case C: Reset -> Dell under 60000 (No Lenovo leakage)
  {
    const histC = `CUSTOMER: "show Lenovo laptops"\nASSISTANT: "Here is Lenovo IdeaPad"\nCUSTOMER: "forget everything"\nASSISTANT: "Sure — I've cleared the previous conversation context."`;
    const rC = detectIntentAndRequirements('show Dell laptops under 60000', histC);
    assert(rC.intent === 'PRODUCT_SEARCH' && rC.requirements.brand === 'Dell' && rC.requirements.maxPrice === 60000, 'Case C: Fresh Dell search with zero Lenovo context');
  }

  // Case D: delivery time? (BUSINESS_RAG, no product dump)
  {
    const rD = detectIntentAndRequirements('what is delivery time?', '');
    assert(rD.intent === 'DELIVERY_QUERY' && rD.searchAllowed === false, 'Case D: "what is delivery time?" -> DELIVERY_QUERY (no product dump)');
  }

  // Case E: why did you show Dell? (Conversational feedback, no search)
  {
    const rE = detectIntentAndRequirements('why did you show Dell?', history, lastAssistantMsg);
    assert(rE.intent === 'CLARIFICATION' && rE.searchAllowed === false, 'Case E: "why did you show Dell?" -> CLARIFICATION');
  }

  // Case F: Dell under 60k -> sorry I meant HP (Preserves 60k budget)
  {
    const histF = `CUSTOMER: "show Dell laptops under 60000"\nASSISTANT: "Here are Dell laptops under ₹60,000"`;
    const rF = detectIntentAndRequirements('sorry I meant HP', histF);
    assert(rF.requirements.brand === 'HP' && rF.requirements.maxPrice === 60000, 'Case F: Brand corrected to HP with budget ₹60,000 preserved');
  }

  // Case G: show laptops under 60000 but not Lenovo
  {
    const rG = detectIntentAndRequirements('show laptops under 60000 but not Lenovo', '');
    assert(rG.intent === 'PRODUCT_SEARCH' && rG.requirements.maxPrice === 60000, 'Case G: Search allowed under ₹60,000');
    assert(rG.requirements.excludedBrands && rG.requirements.excludedBrands.includes('Lenovo'), 'Case G: Lenovo excluded');
  }

  // Case H: which one is cheaper?
  {
    const twoModels = `1. *Dell Inspiron 15 3530* — *₹48,999*\n2. *Lenovo IdeaPad Slim 3* — *₹38,999*`;
    const resH = await generateAiResponse('which one is cheaper?', '', `ASSISTANT: "${twoModels}"`, twoModels);
    assert(resH.reply.includes('Lenovo IdeaPad Slim 3') || resH.reply.includes('₹38,999'), 'Case H: Identifies Lenovo as cheaper model');
  }

  // Case I: that one (Clarifies when multiple active products exist)
  {
    const twoModels = `1. *Dell Inspiron 15 3530* — *₹48,999*\n2. *Lenovo IdeaPad Slim 3* — *₹38,999*`;
    const rI = detectIntentAndRequirements('that one', `ASSISTANT: "${twoModels}"`, twoModels);
    assert(rI.intent === 'CLARIFICATION' || rI.isClarification === true, 'Case I: "that one" asks clarification when 2 products active');
  }


  {
    const rJ = detectIntentAndRequirements('Dell', '', 'Would you like Dell or HP?');
    assert(rJ.intent === 'PRODUCT_SELECTION' || rJ.requirements.brand === 'Dell', 'Case J: "Dell" answers pending brand question');
  }

  // Case K: how much RAM does it have? (Uses active product context)
  {
    const singleProduct = 'Here is the *Dell Inspiron 15 3530* — *₹48,999* with 8GB RAM.';
    const rK = detectIntentAndRequirements('how much RAM does it have?', `ASSISTANT: "${singleProduct}"`, singleProduct);
    assert(rK.intent === 'ATTRIBUTE_QUERY' || rK.intent === 'PRODUCT_RAG', 'Case K: Targets single active Dell model for RAM inquiry');
  }

  // Case L: you misunderstood me (Acknowledges misunderstanding without product dump)
  {
    const rL = detectIntentAndRequirements('you misunderstood me', history, lastAssistantMsg);
    assert(rL.intent === 'CLARIFICATION' && rL.searchAllowed === false, 'Case L: "you misunderstood me" -> CLARIFICATION (no product search)');
  }

  console.log('\n----------------------------------------------------------------');
  console.log(`Production Dialogues Summary: \x1b[32m${passed} Passed\x1b[0m, \x1b[31m${failed} Failed\x1b[0m`);
  console.log('----------------------------------------------------------------\n');

  if (failed > 0) process.exit(1);
}

runProductionDialogues();
