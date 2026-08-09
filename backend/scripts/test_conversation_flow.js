import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

process.env.RAG_TEST_MODE = 'true';
dotenv.config({ path: path.resolve(__dirname, '../.env') });

import { executeRagRetrieval } from '../services/ragService.js';
import { detectIntentAndRequirements } from '../services/intentService.js';

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

async function runLocalConversationFlowSimulation() {
  console.log('\n================================================================');
  console.log('🧪 RUNNING LOCAL MULTI-TURN CONVERSATION FLOW TEST');
  console.log('⚡ (Offline Simulation - Zero WhatsApp / Zero Render / Zero DB Mutation)');
  console.log('================================================================\n');

  // Simulated in-memory customer conversation history
  const conversationMessages = [];

  const addTurn = (sender, text) => {
    conversationMessages.push({ sender, text });
  };

  const getHistoryString = () => {
    return conversationMessages
      .map((m) => `${m.sender === 'customer' ? 'CUSTOMER' : 'ASSISTANT'}: "${m.text}"`)
      .join('\n');
  };

  // Step 1: Customer establishes brand requirement
  addTurn('customer', 'I need an HP laptop.');
  console.log('💬 Customer: "I need an HP laptop."');

  // Step 2: Customer specifies use case
  addTurn('customer', 'For coding.');
  console.log('💬 Customer: "For coding."');

  // Step 3: Customer specifies RAM
  addTurn('customer', '16GB RAM.');
  console.log('💬 Customer: "16GB RAM."');

  // Step 4: Customer asks retrospective memory query: "Which laptop did I ask about?"
  const historyAtStep4 = getHistoryString();
  const step4Analysis = detectIntentAndRequirements('Which laptop did I ask about?', historyAtStep4);
  assert(
    step4Analysis.intent === 'HISTORICAL_QUERY' &&
      step4Analysis.requirements.brand === 'HP' &&
      step4Analysis.requirements.ram === '16GB' &&
      step4Analysis.requirements.useCase === 'coding',
    'Conversation Flow [Step 4]: Memory contains HP + coding + 16GB RAM',
    `Extracted: Brand: ${step4Analysis.requirements.brand}, RAM: ${step4Analysis.requirements.ram}, UseCase: ${step4Analysis.requirements.useCase}`
  );

  // Step 5: Assistant asks for confirmation
  const assistantOffer = 'Would you like me to show available HP laptops with 16GB RAM?';
  addTurn('assistant', assistantOffer);
  console.log(`🤖 Assistant: "${assistantOffer}"`);

  // Customer affirms: "yes"
  console.log('💬 Customer: "yes"');
  const ragStep5 = await executeRagRetrieval('yes', historyAtStep4, assistantOffer);
  assert(
    ragStep5.intent === 'CONFIRMATION' &&
      ragStep5.rawProducts.length > 0 &&
      ragStep5.rawProducts.every((p) => p.brand === 'HP' && p.ram.includes('16GB')),
    'Conversation Flow [Step 5]: "yes" confirmation retrieves matching HP 16GB laptops',
    `Retrieved ${ragStep5.rawProducts.length} models (e.g. ${ragStep5.rawProducts[0]?.brand} ${ragStep5.rawProducts[0]?.model})`
  );

  // Step 6: Customer asks about use case: "What was I going to use it for?"
  const step6Analysis = detectIntentAndRequirements('What was I going to use it for?', historyAtStep4);
  assert(
    step6Analysis.intent === 'HISTORICAL_QUERY' && step6Analysis.requirements.useCase === 'coding',
    'Conversation Flow [Step 6]: Retrospective use case query resolves to "coding"',
    `UseCase: ${step6Analysis.requirements.useCase}`
  );

  // Step 7: Customer asks for return policy: "What is the return policy?"
  const ragStep7 = await executeRagRetrieval('What is the return policy?', historyAtStep4, '');
  assert(
    ragStep7.intent === 'RETURN_POLICY' &&
      ragStep7.rawKnowledge.length > 0 &&
      ragStep7.rawKnowledge[0].content.includes('7 days'),
    'Conversation Flow [Step 7]: Return policy RAG retrieves official 7-day return policy',
    `Knowledge title: ${ragStep7.rawKnowledge[0]?.title}`
  );

  // Step 8: Customer asks for price filter: "Show me laptops under 70000."
  const ragStep8 = await executeRagRetrieval('Show me laptops under 70000.', historyAtStep4, '');
  assert(
    ragStep8.intent === 'PRODUCT_SEARCH' &&
      ragStep8.rawProducts.length > 0 &&
      ragStep8.rawProducts.every((p) => p.price <= 70000),
    'Conversation Flow [Step 8]: Price filter retrieves laptops under ₹70,000',
    `Found ${ragStep8.rawProducts.length} models <= ₹70,000`
  );

  // Step 9: Customer narrows down: "Only HP."
  const historyWithPriceFilter = `${historyAtStep4}\nCUSTOMER: "Show me laptops under 70000."`;
  const ragStep9 = await executeRagRetrieval('Only HP.', historyWithPriceFilter, '');
  assert(
    ragStep9.intent === 'PRODUCT_SEARCH' &&
      ragStep9.rawProducts.length > 0 &&
      ragStep9.rawProducts.every((p) => p.brand === 'HP' && p.price <= 70000),
    'Conversation Flow [Step 9]: "Only HP" narrows filter to HP laptops under ₹70,000',
    `Retrieved: ${ragStep9.rawProducts.map((p) => `${p.model} (₹${p.price})`).join(', ')}`
  );

  console.log('\n----------------------------------------------------------------');
  console.log(`Flow Simulation Summary: \x1b[32m${passed} Passed\x1b[0m, \x1b[31m${failed} Failed\x1b[0m`);
  console.log('----------------------------------------------------------------\n');

  if (failed > 0) process.exit(1);
}

runLocalConversationFlowSimulation().catch((err) => {
  console.error('Conversation flow test failed:', err);
  process.exit(1);
});
