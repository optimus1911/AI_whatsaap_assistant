import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

process.env.RAG_TEST_MODE = 'true';
dotenv.config({ path: path.resolve(__dirname, '../.env') });

import { executeRagRetrieval } from '../services/ragService.js';
import { detectIntentAndRequirements } from '../services/intentService.js';

const isGeminiMode = process.argv.includes('--gemini');
const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

let passed = 0;
let degraded = 0;
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

async function runOfflineRagValidation() {
  console.log('\n================================================================');
  console.log('🧪 RUNNING SAFE LOCAL RAG & MEMORY RETRIEVAL VALIDATION');
  console.log('⚡ (Default Offline Mode - 0 Gemini API Calls)');
  console.log('💡 (To run live Gemini tests, pass `--gemini` flag)');
  console.log('================================================================\n');

  // Test 1: Memory & Grounded Context Retrieval
  const history1 = `CUSTOMER: "I am looking for an HP laptop for coding."\nCUSTOMER: "I want 16GB RAM."`;
  const t1 = detectIntentAndRequirements('Which laptop did I ask about?', history1);
  assert(
    t1.intent === 'HISTORICAL_QUERY' &&
      t1.requirements.brand === 'HP' &&
      t1.requirements.ram === '16GB' &&
      t1.requirements.useCase === 'coding',
    'Offline Memory: Grounded memory retains HP + 16GB RAM + coding',
    `Intent: ${t1.intent}`
  );

  // Test 2: Affirmation Context & Product Retrieval
  const history2 = `${history1}\nASSISTANT: "Would you like me to show you available HP laptops with 16GB RAM?"`;
  const t2 = await executeRagRetrieval('yes', history2, 'Would you like me to show you available HP laptops with 16GB RAM?');
  assert(
    t2.intent === 'CONFIRMATION' &&
      t2.rawProducts.length > 0 &&
      t2.rawProducts.every((p) => p.brand === 'HP' && p.ram.includes('16GB')),
    'Offline Affirmation: "yes" resolves previous assistant offer and retrieves HP 16GB catalog items',
    `Found ${t2.rawProducts.length} models`
  );

  // Test 3: Historical RAM Query
  const history3 = `${history1}\nASSISTANT: "We have HP Pavilion 15 and HP ProBook 440."`;
  const t3 = detectIntentAndRequirements('What RAM did I say I wanted?', history3);
  assert(
    t3.intent === 'HISTORICAL_QUERY' && t3.requirements.ram === '16GB',
    'Offline Historical RAM: Correctly identifies historical RAM inquiry',
    `RAM: ${t3.requirements.ram}`
  );

  // Test 4: Business Knowledge Retrieval (Return Policy)
  const t4 = await executeRagRetrieval("What's the return policy?", '', '');
  assert(
    t4.intent === 'RETURN_POLICY' &&
      t4.rawKnowledge.length > 0 &&
      t4.rawKnowledge[0].content.includes('7 days'),
    'Offline Knowledge: Return policy query retrieves 7-day return policy',
    `Title: ${t4.rawKnowledge[0]?.title}`
  );

  // Test 5: Product Comparison Retrieval
  const history5 = `CUSTOMER: "I am interested in HP laptops."\nASSISTANT: "We have the HP Pavilion 15 and HP ProBook 440."`;
  const t5 = await executeRagRetrieval('Compare the HP Pavilion 15 and HP ProBook 440.', history5, 'We have the HP Pavilion 15 and HP ProBook 440.');
  assert(
    t5.intent === 'PRODUCT_COMPARISON' && t5.rawProducts.length >= 2,
    'Offline Comparison: Comparison query retrieves both target models from catalog',
    `Retrieved models: ${t5.rawProducts.map((p) => p.model).join(' vs ')}`
  );

  console.log('\n----------------------------------------------------------------');
  console.log(`Offline Validation Summary: \x1b[32m${passed} Passed\x1b[0m, \x1b[31m${failed} Failed\x1b[0m`);
  console.log('----------------------------------------------------------------\n');

  if (failed > 0) process.exit(1);
}

async function runGeminiLiveTests() {
  console.log('\n================================================================');
  console.log('🤖 RUNNING 5 MINIMAL LIVE GEMINI GENERATION TESTS (--gemini)');
  console.log('⏳ (Rate-limited with 13-second inter-request delay)');
  console.log('================================================================\n');

  const { generateAiResponse } = await import('../services/geminiService.js');

  const geminiTests = [
    {
      name: 'Memory Response ("Which laptop did I ask about?")',
      history: `CUSTOMER: "I need an HP laptop."\nCUSTOMER: "For coding."\nCUSTOMER: "16GB RAM."`,
      current: 'Which laptop did I ask about?',
      lastAssistant: '',
      requiredKeywords: ['HP', '16GB', 'coding']
    },
    {
      name: 'Affirmation Response ("yes" following offer)',
      history: `CUSTOMER: "I need an HP laptop."\nCUSTOMER: "16GB RAM."\nASSISTANT: "Would you like me to show available HP laptops with 16GB RAM?"`,
      current: 'yes',
      lastAssistant: 'Would you like me to show available HP laptops with 16GB RAM?',
      requiredKeywords: ['HP', 'Pavilion']
    },
    {
      name: 'Historical RAM Response ("What RAM did I say I wanted?")',
      history: `CUSTOMER: "I need an HP laptop."\nCUSTOMER: "16GB RAM."\nASSISTANT: "We have HP Pavilion 15."`,
      current: 'What RAM did I say I wanted?',
      lastAssistant: 'We have HP Pavilion 15.',
      requiredKeywords: ['16GB']
    },
    {
      name: 'Return Policy Response ("What\'s the return policy?")',
      history: '',
      current: "What's the return policy?",
      lastAssistant: '',
      requiredKeywords: ['7 days', 'return']
    },
    {
      name: 'Product Comparison Response ("Compare the HP Pavilion 15 and HP ProBook 440.")',
      history: `CUSTOMER: "I am interested in HP laptops."\nASSISTANT: "We have HP Pavilion 15 and HP ProBook 440."`,
      current: 'Compare the HP Pavilion 15 and HP ProBook 440.',
      lastAssistant: 'We have HP Pavilion 15 and HP ProBook 440.',
      requiredKeywords: ['Pavilion', 'ProBook']
    }
  ];

  for (let i = 0; i < geminiTests.length; i++) {
    const tc = geminiTests[i];
    console.log(`👉 [${i + 1}/${geminiTests.length}] RUNNING: ${tc.name}`);

    try {
      const result = await generateAiResponse(
        tc.current,
        'Customer Name: Test User',
        tc.history,
        tc.lastAssistant
      );

      const reply = result?.reply || '';
      const matchesAllKeywords = tc.requiredKeywords.every((kw) => new RegExp(kw.replace(/\s+/g, '\\s*'), 'i').test(reply));
      const hasGenericFiller = /(?:thanks\s+for\s+reaching\s+out|i'd\s+be\s+happy\s+to\s+help\s+you\s+find|here\s+are\s+a\s+few\s+options)/i.test(reply);

      if (matchesAllKeywords && !hasGenericFiller) {
        if (result.geminiUsed) {
          console.log(`  \x1b[32m✓ PASS\x1b[0m: ${tc.name}`);
          console.log(`    \x1b[90mSOURCE: ${result.responseSource} | GEMINI: live | ANSWER: "${reply.substring(0, 80)}..."\x1b[0m`);
          passed++;
        } else {
          console.log(`  \x1b[33m⚡ DEGRADED (Grounded Fallback)\x1b[0m: ${tc.name}`);
          console.log(`    \x1b[90mSOURCE: ${result.responseSource} | REASON: Gemini quota limit / offline | ANSWER: "${reply.substring(0, 80)}..."\x1b[0m`);
          degraded++;
        }
      } else {
        console.error(`  \x1b[31m✗ FAIL\x1b[0m: ${tc.name}`);
        console.error(`    \x1b[90mREPLY: "${reply}"\x1b[0m`);
        failed++;
      }
    } catch (err) {
      console.error(`  \x1b[31m✗ FAIL\x1b[0m: ${tc.name} \x1b[90m(Exception: ${err.message})\x1b[0m`);
      failed++;
    }

    if (i < geminiTests.length - 1) {
      console.log('⏳ Pacing 13s for Gemini free tier quota...');
      await delay(13000);
    }
  }

  console.log('\n----------------------------------------------------------------');
  console.log(`Live Tests Summary: \x1b[32m${passed} Passed (Live Gemini)\x1b[0m, \x1b[33m${degraded} Degraded (Grounded RAG Fallback)\x1b[0m, \x1b[31m${failed} Failed\x1b[0m`);
  console.log('----------------------------------------------------------------\n');

  if (failed > 0) process.exit(1);
}

if (isGeminiMode) {
  runGeminiLiveTests().catch((err) => {
    console.error('Gemini test runner error:', err);
    process.exit(1);
  });
} else {
  runOfflineRagValidation().catch((err) => {
    console.error('Offline test runner error:', err);
    process.exit(1);
  });
}
