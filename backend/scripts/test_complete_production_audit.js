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

async function runCompleteProductionAudit() {
  console.log('\n================================================================');
  console.log('🧪 RUNNING COMPLETE PRODUCTION DIALOGUE AUDIT (SECTION 30 REPLAY)');
  console.log('⚡ (Simulating Full 8-Turn WhatsApp Conversational Session)');
  console.log('================================================================\n');

  let conversationHistory = '';
  let lastAssistantMessage = '';

  // Turn 1: Reset
  console.log('--- Turn 1: USER: "forget everything" ---');
  {
    const intentRes = detectIntentAndRequirements('forget everything', conversationHistory, lastAssistantMessage);
    assert(intentRes.intent === 'CONVERSATION_RESET', 'Turn 1 Intent is CONVERSATION_RESET');
    assert(intentRes.searchAllowed === false, 'Turn 1 searchAllowed is false');

    const res = await generateAiResponse('forget everything', '', conversationHistory, lastAssistantMessage);
    assert(res.reply.toLowerCase().includes('cleared') || res.reply.toLowerCase().includes('fresh'), 'Turn 1 reset response generated');
    assert(res.responseSource === 'DETERMINISTIC_FALLBACK' || res.responseSource === 'CONVERSATION_RESET', 'Turn 1 responseSource is valid');

    lastAssistantMessage = res.reply;
    conversationHistory += `CUSTOMER: "forget everything"\nASSISTANT: "${lastAssistantMessage}"\n`;
  }

  // Turn 2: Typo Search Request
  console.log('\n--- Turn 2: USER: "hi i need del laptop under 60000" ---');
  {
    const intentRes = detectIntentAndRequirements('hi i need del laptop under 60000', conversationHistory, lastAssistantMessage);
    assert(intentRes.intent === 'PRODUCT_SEARCH', 'Turn 2 Intent is PRODUCT_SEARCH');
    assert(intentRes.requirements.brand === 'Dell', 'Turn 2 Brand normalized to Dell');
    assert(intentRes.requirements.maxPrice === 60000, 'Turn 2 Max price is ₹60,000');
    assert(intentRes.searchAllowed === true, 'Turn 2 searchAllowed is true');

    const res = await generateAiResponse('hi i need del laptop under 60000', '', conversationHistory, lastAssistantMessage);
    assert(res.reply.toLowerCase().includes('dell'), 'Turn 2 returns Dell laptops');

    lastAssistantMessage = res.reply;
    conversationHistory += `CUSTOMER: "hi i need del laptop under 60000"\nASSISTANT: "${lastAssistantMessage}"\n`;
  }

  // Turn 3: Product Selection ("first one")
  console.log('\n--- Turn 3: USER: "first one" ---');
  {
    const intentRes = detectIntentAndRequirements('first one', conversationHistory, lastAssistantMessage);
    assert(intentRes.intent === 'PRODUCT_SELECTION', 'Turn 3 Intent is PRODUCT_SELECTION');
    assert(intentRes.searchAllowed === false, 'Turn 3 searchAllowed is false (no new search)');

    const res = await generateAiResponse('first one', '', conversationHistory, lastAssistantMessage);
    assert(res.reply.includes('Dell Inspiron 15 3530') || res.reply.includes('Dell Vostro 3520'), 'Turn 3 selects first Dell laptop');
    assert(res.responseSource === 'PRODUCT_CONTEXT', 'Turn 3 responseSource is PRODUCT_CONTEXT');

    lastAssistantMessage = res.reply;
    conversationHistory += `CUSTOMER: "first one"\nASSISTANT: "${lastAssistantMessage}"\n`;
  }

  // Turn 4: Policy Question ("what is delivery time?")
  console.log('\n--- Turn 4: USER: "what is delivery time?" ---');
  {
    const intentRes = detectIntentAndRequirements('what is delivery time?', conversationHistory, lastAssistantMessage);
    assert(intentRes.intent === 'DELIVERY_QUERY', 'Turn 4 Intent is DELIVERY_QUERY');
    assert(intentRes.searchAllowed === false, 'Turn 4 searchAllowed is false (no product dump)');

    const res = await generateAiResponse('what is delivery time?', '', conversationHistory, lastAssistantMessage);
    assert(res.reply.toLowerCase().includes('delivery') || res.reply.toLowerCase().includes('business days'), 'Turn 4 answers delivery policy');
    assert(!res.reply.includes('1. *') || !res.reply.includes('₹'), 'Turn 4 does NOT contain product search list');

    lastAssistantMessage = res.reply;
    conversationHistory += `CUSTOMER: "what is delivery time?"\nASSISTANT: "${lastAssistantMessage}"\n`;
  }

  // Turn 5: Warranty for active item ("what about warranty?")
  console.log('\n--- Turn 5: USER: "what about warranty?" ---');
  {
    const intentRes = detectIntentAndRequirements('what about warranty?', conversationHistory, lastAssistantMessage);
    assert(intentRes.intent === 'WARRANTY_QUERY', 'Turn 5 Intent is WARRANTY_QUERY');
    assert(intentRes.searchAllowed === false, 'Turn 5 searchAllowed is false');

    const res = await generateAiResponse('what about warranty?', '', conversationHistory, lastAssistantMessage);
    assert(res.reply.toLowerCase().includes('warranty') || res.reply.toLowerCase().includes('year'), 'Turn 5 answers warranty policy');

    lastAssistantMessage = res.reply;
    conversationHistory += `CUSTOMER: "what about warranty?"\nASSISTANT: "${lastAssistantMessage}"\n`;
  }

  // Turn 6: Cross-Brand Comparison ("actually compare it with HP")
  console.log('\n--- Turn 6: USER: "actually compare it with HP" ---');
  {
    const intentRes = detectIntentAndRequirements('actually compare it with HP', conversationHistory, lastAssistantMessage);
    assert(intentRes.intent === 'PRODUCT_COMPARISON', 'Turn 6 Intent is PRODUCT_COMPARISON');
    assert(intentRes.searchAllowed === false, 'Turn 6 searchAllowed is false');
    assert(intentRes.requirements.mentionedModels.some(m => m.includes('Dell')) && intentRes.requirements.mentionedModels.some(m => m.includes('HP')), 'Turn 6 compares active Dell with HP');

    const res = await generateAiResponse('actually compare it with HP', '', conversationHistory, lastAssistantMessage);
    assert(res.reply.toLowerCase().includes('comparison') || res.reply.toLowerCase().includes('vs'), 'Turn 6 generates side-by-side comparison');

    lastAssistantMessage = res.reply;
    conversationHistory += `CUSTOMER: "actually compare it with HP"\nASSISTANT: "${lastAssistantMessage}"\n`;
  }

  // Turn 7: Comparative Selector ("the cheaper one")
  console.log('\n--- Turn 7: USER: "the cheaper one" ---');
  {
    const intentRes = detectIntentAndRequirements('the cheaper one', conversationHistory, lastAssistantMessage);
    assert(intentRes.intent === 'PRODUCT_SELECTION', 'Turn 7 Intent is PRODUCT_SELECTION');
    assert(intentRes.searchAllowed === false, 'Turn 7 searchAllowed is false');

    const res = await generateAiResponse('the cheaper one', '', conversationHistory, lastAssistantMessage);
    assert(res.responseSource === 'PRODUCT_CONTEXT', 'Turn 7 responseSource is PRODUCT_CONTEXT');

    lastAssistantMessage = res.reply;
    conversationHistory += `CUSTOMER: "the cheaper one"\nASSISTANT: "${lastAssistantMessage}"\n`;
  }

  // Turn 8: Conversational Question / Complaint ("why did you show that?")
  console.log('\n--- Turn 8: USER: "why did you show that?" ---');
  {
    const intentRes = detectIntentAndRequirements('why did you show that?', conversationHistory, lastAssistantMessage);
    assert(intentRes.intent === 'CLARIFICATION', 'Turn 8 Intent is CLARIFICATION');
    assert(intentRes.searchAllowed === false, 'Turn 8 searchAllowed is false');

    const res = await generateAiResponse('why did you show that?', '', conversationHistory, lastAssistantMessage);
    assert(!res.reply.includes('1. *') && !res.reply.includes('2. *'), 'Turn 8 does NOT dump products');
  }

  console.log('\n----------------------------------------------------------------');
  console.log(`Complete Dialogue Audit Summary: \x1b[32m${passed} Passed\x1b[0m, \x1b[31m${failed} Failed\x1b[0m`);
  console.log('----------------------------------------------------------------\n');

  if (failed > 0) process.exit(1);
}

runCompleteProductionAudit();
