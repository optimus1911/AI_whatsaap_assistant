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
  console.log('\n====================================================');
  console.log('SPECIFIC 9-CASE VERIFICATION RUN');
  console.log('====================================================\n');

  let allPassed = true;

  for (const tc of testCases) {
    const intentRes = detectIntentAndRequirements(tc.text);
    const aiRes = await generateAiResponse(tc.text);

    const intentOk = intentRes.intent === tc.expectedIntent;
    const searchOk = intentRes.searchAllowed === tc.shouldSearch;
    const noCatalogLeak = !aiRes.reply.includes("I couldn't find a laptop");

    if (!intentOk || !searchOk || !noCatalogLeak) {
      allPassed = false;
    }

    console.log(`INPUT:               "${tc.text}"`);
    console.log(`DETECTED INTENT:     ${intentRes.intent} (Expected: ${tc.expectedIntent}) -> ${intentOk ? '✅ MATCH' : '❌ MISMATCH'}`);
    console.log(`SEARCH ALLOWED:      ${intentRes.searchAllowed} (Expected: ${tc.shouldSearch}) -> ${searchOk ? '✅ MATCH' : '❌ MISMATCH'}`);
    console.log(`CATALOG LEAK CHECK:  ${noCatalogLeak ? '✅ CLEAN (No catalog error leak)' : '❌ LEAK DETECTED'}`);
    console.log(`ASSISTANT REPLY:     "${aiRes.reply}"`);
    console.log(`RESPONSE SOURCE:     ${aiRes.responseSource}`);
    console.log('----------------------------------------------------\n');
  }

  console.log(`OVERALL STATUS: ${allPassed ? '✅ ALL 9 CASES VERIFIED SUCCESSFULLY' : '❌ VERIFICATION FAILED'}\n`);
  if (!allPassed) process.exit(1);
}

run();
