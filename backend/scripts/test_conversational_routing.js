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
  console.log('🧪 RUNNING CONVERSATIONAL INTENT ROUTING VERIFICATION');
  console.log('================================================================\n');

  // Test 1: GREETING intents
  const greetings = ['hi', 'hello', 'hey', 'hii', 'hiii', 'helo', 'good morning', 'good afternoon', 'good evening', 'namaste'];
  console.log('--- 1. Testing GREETING Inputs ---');
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

  // Test 2: CAPABILITY intents
  const capabilities = [
    'what can you do',
    'what do you do',
    'who are you',
    'how can you help',
    'how can you help me',
    'what can you help me with',
    'what is this'
  ];
  console.log('\n--- 2. Testing CAPABILITY Inputs ---');
  for (const text of capabilities) {
    const intentRes = detectIntentAndRequirements(text);
    assert(
      intentRes.intent === 'CAPABILITY' && intentRes.searchAllowed === false && intentRes.isDirectReply === true,
      `detectIntentAndRequirements("${text}") -> CAPABILITY (isDirectReply=true, searchAllowed=false)`,
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

  // Test 3: THANKS intents
  const thanksList = ['thanks', 'thank you', 'thanks a lot', 'thankyou', 'shukriya', 'dhanyawad'];
  console.log('\n--- 3. Testing THANKS Inputs ---');
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

  // Test 4: GOODBYE intents
  const goodbyes = ['bye', 'goodbye', 'see you', 'see you later', 'good night'];
  console.log('\n--- 4. Testing GOODBYE Inputs ---');
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

  // Test 5: CASUAL_CONVERSATION intents
  const casuals = ['ok', 'okay', 'great', 'nice', 'cool', 'alright', 'got it', 'understood'];
  console.log('\n--- 5. Testing CASUAL_CONVERSATION Inputs ---');
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

  // Test 6: Verify Product Search is STILL allowed when explicit search query is given
  console.log('\n--- 6. Testing Explicit Product Search Inputs ---');
  const searchQueries = ['show laptops under 60000', 'Dell laptop with 16GB RAM', 'ASUS gaming laptop under 80000'];
  for (const text of searchQueries) {
    const intentRes = detectIntentAndRequirements(text);
    assert(
      intentRes.intent === 'PRODUCT_SEARCH' && intentRes.searchAllowed === true,
      `detectIntentAndRequirements("${text}") -> PRODUCT_SEARCH (searchAllowed=true)`,
      `Got intent=${intentRes.intent}, searchAllowed=${intentRes.searchAllowed}`
    );
  }

  console.log('\n----------------------------------------------------------------');
  console.log(`Conversational Routing Summary: \x1b[32m${passed} Passed\x1b[0m, \x1b[31m${failed} Failed\x1b[0m`);
  console.log('----------------------------------------------------------------\n');

  if (failed > 0) process.exit(1);
}

runConversationalRoutingTests();
