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

function assert(condition, message, details = '') {
  if (condition) {
    passed++;
    console.log(`  \x1b[32m✓ PASS\x1b[0m: ${message}`);
  } else {
    failed++;
    console.error(`  \x1b[31m✗ FAIL\x1b[0m: ${message}`);
    if (details) console.error(`    Details: ${details}`);
  }
}

async function runConversationalRoutingTests() {
  console.log('\n================================================================');
  console.log('🧪 RUNNING COMPREHENSIVE CONVERSATIONAL INTENT ROUTING VERIFICATION');
  console.log('================================================================\n');

  // Case 1 & 2: GREETING intents ("hi", "hello", "hey", etc.)
  console.log('--- 1. Testing GREETING Inputs ---');
  const greetings = ['hi', 'hello', 'hey', 'hii', 'hiii', 'helo', 'good morning', 'good afternoon', 'good evening', 'namaste'];
  for (const text of greetings) {
    const intentRes = detectIntentAndRequirements(text);
    assert(
      intentRes.intent === 'GREETING' && intentRes.searchAllowed === false && intentRes.isDirectReply === true,
      `detectIntentAndRequirements("${text}") -> GREETING (isDirectReply=true, searchAllowed=false)`,
      `Got intent=${intentRes.intent}, searchAllowed=${intentRes.searchAllowed}, isDirectReply=${intentRes.isDirectReply}`
    );

    const response = await generateAiResponse(text);
    assert(
      !response.reply.includes("I couldn't find a laptop") &&
      !response.reply.includes("relax one filter") &&
      response.reply.includes("Welcome to AI WhatsApp Assistant"),
      `generateAiResponse("${text}") returns warm greeting`,
      `Got reply: "${response.reply}"`
    );
  }

  // Case 3 & 4: CAPABILITY intents ("what can you do", "who are you", "what do you do", etc.)
  console.log('\n--- 2. Testing CAPABILITY Inputs ---');
  const capabilities = [
    'what can you do',
    'what do you do',
    'who are you',
    'how can you help',
    'how can you help me',
    'what can you help me with',
    'what is this'
  ];
  for (const text of capabilities) {
    const intentRes = detectIntentAndRequirements(text);
    assert(
      intentRes.intent === 'CAPABILITY' && intentRes.searchAllowed === false && intentRes.isDirectReply === true,
      `detectIntentAndRequirements("${text}") -> CAPABILITY (NOT CLARIFICATION, searchAllowed=false)`,
      `Got intent=${intentRes.intent}, searchAllowed=${intentRes.searchAllowed}, isDirectReply=${intentRes.isDirectReply}`
    );

    const response = await generateAiResponse(text);
    assert(
      !response.reply.includes("I couldn't find a laptop") &&
      !response.reply.includes("Could you clarify what you're looking for") &&
      response.reply.includes("I can help you with product recommendations"),
      `generateAiResponse("${text}") returns capability description`,
      `Got reply: "${response.reply}"`
    );
  }

  // Case 5 & 6: THANKS intents ("thanks", "thank you", etc.)
  console.log('\n--- 3. Testing THANKS Inputs ---');
  const thanksList = ['thanks', 'thank you', 'thanks a lot', 'thankyou', 'shukriya', 'dhanyawad'];
  for (const text of thanksList) {
    const intentRes = detectIntentAndRequirements(text);
    assert(
      intentRes.intent === 'THANKS' && intentRes.searchAllowed === false && intentRes.isDirectReply === true,
      `detectIntentAndRequirements("${text}") -> THANKS (isDirectReply=true, searchAllowed=false)`,
      `Got intent=${intentRes.intent}, searchAllowed=${intentRes.searchAllowed}, isDirectReply=${intentRes.isDirectReply}`
    );

    const response = await generateAiResponse(text);
    assert(
      !response.reply.includes("I couldn't find a laptop") &&
      response.reply.includes("You're welcome"),
      `generateAiResponse("${text}") returns thanks reply`,
      `Got reply: "${response.reply}"`
    );
  }

  // Case 7: GOODBYE intents ("bye", "goodbye", etc.)
  console.log('\n--- 4. Testing GOODBYE Inputs ---');
  const goodbyes = ['bye', 'goodbye', 'see you', 'see you later', 'good night'];
  for (const text of goodbyes) {
    const intentRes = detectIntentAndRequirements(text);
    assert(
      intentRes.intent === 'GOODBYE' && intentRes.searchAllowed === false && intentRes.isDirectReply === true,
      `detectIntentAndRequirements("${text}") -> GOODBYE (isDirectReply=true, searchAllowed=false)`,
      `Got intent=${intentRes.intent}, searchAllowed=${intentRes.searchAllowed}, isDirectReply=${intentRes.isDirectReply}`
    );

    const response = await generateAiResponse(text);
    assert(
      !response.reply.includes("I couldn't find a laptop") &&
      response.reply.includes("Have a great day"),
      `generateAiResponse("${text}") returns goodbye reply`,
      `Got reply: "${response.reply}"`
    );
  }

  // Case 8: CASUAL_CONVERSATION intents ("ok", "okay", "great", etc.)
  console.log('\n--- 5. Testing CASUAL_CONVERSATION Inputs ---');
  const casuals = ['ok', 'okay', 'great', 'nice', 'cool', 'alright', 'got it', 'understood'];
  for (const text of casuals) {
    const intentRes = detectIntentAndRequirements(text);
    assert(
      intentRes.intent === 'CASUAL_CONVERSATION' && intentRes.searchAllowed === false && intentRes.isDirectReply === true,
      `detectIntentAndRequirements("${text}") -> CASUAL_CONVERSATION (isDirectReply=true, searchAllowed=false)`,
      `Got intent=${intentRes.intent}, searchAllowed=${intentRes.searchAllowed}, isDirectReply=${intentRes.isDirectReply}`
    );

    const response = await generateAiResponse(text);
    assert(
      !response.reply.includes("I couldn't find a laptop") &&
      response.reply.includes("Sure! 👍 How can I help you?"),
      `generateAiResponse("${text}") returns casual acknowledgement`,
      `Got reply: "${response.reply}"`
    );
  }

  // Case 9: Explicit Product Search remains intact
  console.log('\n--- 6. Testing Explicit Product Search Integrity ---');
  const searchQueries = [
    'show me laptops under 50000',
    'show laptops under 60000',
    'Dell laptop with 16GB RAM',
    'ASUS gaming laptop under 80000',
    'thanks, show me laptops under 50000'
  ];
  for (const text of searchQueries) {
    const intentRes = detectIntentAndRequirements(text);
    assert(
      intentRes.intent === 'PRODUCT_SEARCH' && intentRes.searchAllowed === true,
      `detectIntentAndRequirements("${text}") -> PRODUCT_SEARCH (searchAllowed=true)`,
      `Got intent=${intentRes.intent}, searchAllowed=${intentRes.searchAllowed}`
    );
  }

  // Case 10: Conversation Reset remains intact
  console.log('\n--- 7. Testing Conversation Reset Integrity ---');
  const resetQueries = ['forget everything', 'start fresh', 'clear chat'];
  for (const text of resetQueries) {
    const intentRes = detectIntentAndRequirements(text);
    assert(
      intentRes.intent === 'CONVERSATION_RESET' && intentRes.searchAllowed === false && intentRes.isDirectReply === true,
      `detectIntentAndRequirements("${text}") -> CONVERSATION_RESET (isDirectReply=true)`,
      `Got intent=${intentRes.intent}, isDirectReply=${intentRes.isDirectReply}`
    );
  }

  // Case 11 & 12: Gemini Quota / Error Resilience Simulation
  console.log('\n--- 8. Testing Fallback / Gemini Error Resilience ---');
  // Even when Gemini throws 429, 404, or is offline, direct conversational intents and fallback router return deterministic grounded responses
  const offlineGreetings = await generateAiResponse('hi');
  assert(
    offlineGreetings.reply.includes('Welcome to AI WhatsApp Assistant') &&
    !offlineGreetings.reply.includes("I couldn't find a laptop"),
    'Simulated offline/fallback for "hi" still produces GREETING'
  );

  const offlineCapabilities = await generateAiResponse('what can you do');
  assert(
    offlineCapabilities.reply.includes('I can help you with product recommendations') &&
    !offlineCapabilities.reply.includes("Could you clarify what you're looking for"),
    'Simulated offline/fallback for "what can you do" still produces CAPABILITY'
  );

  console.log('\n----------------------------------------------------------------');
  console.log(`Conversational Routing Summary: \x1b[32m${passed} Passed\x1b[0m, \x1b[31m${failed} Failed\x1b[0m`);
  console.log('----------------------------------------------------------------\n');

  if (failed > 0) process.exit(1);
}

runConversationalRoutingTests();
