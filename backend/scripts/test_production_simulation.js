import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

process.env.RAG_TEST_MODE = 'true';
dotenv.config({ path: path.resolve(__dirname, '../.env') });

import { generateAiResponse } from '../services/geminiService.js';
import { searchProducts } from '../services/productSearchService.js';
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

async function runProductionSimulation() {
  console.log('\n================================================================');
  console.log('🚀 RUNNING PRODUCTION WHATSAPP FLOW SIMULATION (6 KEY SCENARIOS)');
  console.log('⚡ (Exact Call-Chain Trace: Webhook -> RAG -> Fallback -> Reply)');
  console.log('================================================================\n');

  // ----------------------------------------------------------------
  // SCENARIO 1: "I want HP laptop under 70000"
  // ----------------------------------------------------------------
  console.log('👉 [1/6] Scenario 1: "I want HP laptop under 70000"');
  const res1 = await generateAiResponse('I want HP laptop under 70000', '', '');
  const hasHp1 = res1.reply.includes('HP') && (res1.reply.includes('Pavilion') || res1.reply.includes('Victus'));
  const hasNoFiller1 = !res1.reply.includes("don't have enough specific information");
  assert(
    hasHp1 && hasNoFiller1 && res1.responseSource !== 'UNKNOWN',
    'Scenario 1: Returns real HP laptops under ₹70,000',
    `Source: ${res1.responseSource} | Has HP: ${hasHp1}`
  );

  // ----------------------------------------------------------------
  // SCENARIO 2: "I want HP laptop under 70000" while Gemini is quota-exhausted
  // ----------------------------------------------------------------
  console.log('\n👉 [2/6] Scenario 2: "I want HP laptop under 70000" under quota cooldown');
  const res2 = await generateAiResponse('I want HP laptop under 70000', '', '');
  const hasHp2 = res2.reply.includes('HP') && (res2.reply.includes('Pavilion') || res2.reply.includes('Victus'));
  assert(
    hasHp2 && res2.responseSource === 'DETERMINISTIC_FALLBACK' && !res2.geminiUsed,
    'Scenario 2: Returns same real HP products using deterministic fallback',
    `Source: ${res2.responseSource} | GeminiUsed: ${res2.geminiUsed}`
  );

  // ----------------------------------------------------------------
  // SCENARIO 3: "What is the return policy?"
  // ----------------------------------------------------------------
  console.log('\n👉 [3/6] Scenario 3: "What is the return policy?"');
  const res3 = await generateAiResponse('What is the return policy?', '', '');
  assert(
    res3.reply.includes('7 days') && (res3.responseSource === 'BUSINESS_RAG' || res3.responseSource === 'GEMINI_WITH_BUSINESS_RAG'),
    'Scenario 3: Returns official 7-day return policy',
    `Source: ${res3.responseSource} | Reply: "${res3.reply.substring(0, 70)}..."`
  );

  // ----------------------------------------------------------------
  // SCENARIO 4: Multi-turn HP + Coding -> 16GB RAM -> "yes"
  // ----------------------------------------------------------------
  console.log('\n👉 [4/6] Scenario 4: Multi-turn HP Coding -> 16GB RAM -> "yes"');
  let history4 = `CUSTOMER: "I need an HP laptop for coding."\nCUSTOMER: "16GB RAM."`;
  const offer4 = 'Would you like me to show available HP laptops with 16GB RAM?';
  history4 += `\nASSISTANT: "${offer4}"`;
  const res4 = await generateAiResponse('yes', '', history4, offer4);
  const hasHp16gb = res4.reply.includes('HP') && (res4.reply.includes('Pavilion') || res4.reply.includes('ProBook'));
  assert(
    hasHp16gb && res4.responseSource !== 'UNKNOWN',
    'Scenario 4: "yes" resolves previous offer and returns HP 16GB models',
    `Source: ${res4.responseSource}`
  );

  // ----------------------------------------------------------------
  // SCENARIO 5: "Actually Dell" Explicit Brand Override
  // ----------------------------------------------------------------
  console.log('\n👉 [5/6] Scenario 5: "Actually Dell" explicit brand override');
  const override5 = detectIntentAndRequirements('Actually Dell', history4);
  const dellProducts = await searchProducts({ brand: override5.requirements.brand });
  assert(
    override5.requirements.brand === 'Dell' && dellProducts.length > 0 && dellProducts.every((p) => p.brand === 'Dell'),
    'Scenario 5: Explicit override switches brand from HP to Dell',
    `Brand: ${override5.requirements.brand} (${dellProducts.length} Dell models found)`
  );


  console.log('\n👉 [6/6] Scenario 6: "Compare HP Pavilion 15 and HP ProBook 440"');
  const res6 = await generateAiResponse(
    'Compare HP Pavilion 15 and HP ProBook 440',
    '',
    'ASSISTANT: "We have HP Pavilion 15 and HP ProBook 440."'
  );
  assert(
    res6.reply.includes('Pavilion 15') && res6.reply.includes('ProBook 440') && (res6.responseSource === 'PRODUCT_COMPARISON' || res6.responseSource === 'GEMINI_RAG'),
    'Scenario 6: Both catalog products retrieved and compared side-by-side',
    `Source: ${res6.responseSource}`
  );

  console.log('\n================================================================');
  console.log(`Simulation Summary: \x1b[32m${passed} Passed\x1b[0m, \x1b[31m${failed} Failed\x1b[0m`);
  console.log('================================================================\n');

  if (failed > 0) process.exit(1);
}

runProductionSimulation().catch((err) => {
  console.error('Production simulation failed:', err);
  process.exit(1);
});
