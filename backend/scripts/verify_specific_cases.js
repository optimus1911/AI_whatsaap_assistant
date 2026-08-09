import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

process.env.RAG_TEST_MODE = 'true';
dotenv.config({ path: path.resolve(__dirname, '../.env') });

import { detectIntentAndRequirements } from '../services/intentService.js';
import { generateAiResponse } from '../services/geminiService.js';

const testCases = [
  { text: 'hi', expectedIntent: 'GREETING', shouldSearch: false },
  { text: 'hello', expectedIntent: 'GREETING', shouldSearch: false },
  { text: 'what can you do', expectedIntent: 'CAPABILITY', shouldSearch: false },
  { text: 'who are you', expectedIntent: 'CAPABILITY', shouldSearch: false },
  { text: 'thanks', expectedIntent: 'THANKS', shouldSearch: false },
  { text: 'bye', expectedIntent: 'GOODBYE', shouldSearch: false },
  { text: 'okay', expectedIntent: 'CASUAL_CONVERSATION', shouldSearch: false },
  { text: 'show me products under 50000', expectedIntent: 'PRODUCT_SEARCH', shouldSearch: true },
  { text: 'forget everything', expectedIntent: 'CONVERSATION_RESET', shouldSearch: false }
];

async function run() {
  console.log('\n========================================================================');
  console.log('🧪 CONVERSATIONAL INTENT & CATALOG SAFETY VERIFICATION (9 CASES)');
  console.log('========================================================================\n');

  let allPassed = true;
  const results = [];

  for (let i = 0; i < testCases.length; i++) {
    const tc = testCases[i];
    
    // Temporarily suppress verbose internal debug trace logs during turn execution
    const originalLog = console.log;
    const originalWarn = console.warn;
    console.log = () => {};
    console.warn = () => {};

    let intentRes, aiRes;
    try {
      intentRes = detectIntentAndRequirements(tc.text);
      aiRes = await generateAiResponse(tc.text);
    } finally {
      console.log = originalLog;
      console.warn = originalWarn;
    }

    const intentOk = intentRes.intent === tc.expectedIntent;
    const searchOk = intentRes.searchAllowed === tc.shouldSearch;
    const noCatalogLeak = !aiRes.reply.includes("I couldn't find a laptop");
    const casePassed = intentOk && searchOk && noCatalogLeak;

    if (!casePassed) {
      allPassed = false;
    }

    results.push({
      caseNumber: i + 1,
      input: tc.text,
      expectedIntent: tc.expectedIntent,
      detectedIntent: intentRes.intent,
      intentOk,
      expectedSearch: tc.shouldSearch,
      actualSearch: intentRes.searchAllowed,
      searchOk,
      noCatalogLeak,
      reply: aiRes.reply,
      responseSource: aiRes.responseSource,
      casePassed
    });
  }

  // Print crisp structured summary for each of the 9 test cases
  for (const r of results) {
    const statusIcon = r.casePassed ? '✅ PASS' : '❌ FAIL';
    console.log(`CASE ${r.caseNumber}: "${r.input}" [${statusIcon}]`);
    console.log(`  • Intent:           ${r.detectedIntent} (Expected: ${r.expectedIntent}) -> ${r.intentOk ? '✅ MATCH' : '❌ FAIL'}`);
    console.log(`  • Search Allowed:   ${r.actualSearch} (Expected: ${r.expectedSearch}) -> ${r.searchOk ? '✅ MATCH' : '❌ FAIL'}`);
    console.log(`  • No Catalog Leak:  ${r.noCatalogLeak ? '✅ CLEAN' : '❌ LEAKED ERROR'}`);
    console.log(`  • Source Tag:       ${r.responseSource}`);
    console.log(`  • Reply Text:       "${r.reply.replace(/\n/g, ' ')}"`);
    console.log('------------------------------------------------------------------------');
  }

  console.log(`\nOVERALL VERIFICATION RESULT: ${allPassed ? '✅ 9/9 TEST CASES PASSED (100% GREEN)' : '❌ TEST FAILURES DETECTED'}`);
  console.log('========================================================================\n');

  process.exitCode = allPassed ? 0 : 1;
}

run();
