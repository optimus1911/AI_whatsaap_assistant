import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

process.env.RAG_TEST_MODE = 'true';
dotenv.config({ path: path.resolve(__dirname, '../.env') });

import { detectIntentAndRequirements } from '../services/intentService.js';
import { executeRagRetrieval } from '../services/ragService.js';
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

async function runAmbiguityGateTests() {
  console.log('\n==================================================');
  console.log('🧪 RUNNING AMBIGUITY GATE & NEVER-INVENT-SEARCH SUITE');
  console.log('⚡ (16 Comprehensive Tests - Offline & RAG Pipeline)');
  console.log('==================================================\n');

  // Test 1: "is this available to you" without active product -> CLARIFICATION, No PRODUCT_SEARCH
  console.log('--- Test 1: Ambiguous Message Without Product Context ---');
  {
    const r = detectIntentAndRequirements('is this available to you', '', '');
    assert(r.intent === 'CLARIFICATION', 'Intent: "is this available to you" → CLARIFICATION', `Got: ${r.intent}`);
    assert(r.searchAllowed === false, 'searchAllowed is false', `Got: ${r.searchAllowed}`);
    assert(r.isClarification === true, 'isClarification is true', `Got: ${r.isClarification}`);
    assert(r.requirements.brand === null, 'Brand is null (not invented)', `Got: ${r.requirements.brand}`);
    assert(r.requirements.maxPrice === null, 'MaxPrice is null (not invented)', `Got: ${r.requirements.maxPrice}`);
  }

  // Test 2: "is this available?" with 1 active product -> AVAILABILITY_QUERY for Dell Vostro 3520
  console.log('\n--- Test 2: Unambiguous Availability Query (1 Active Product) ---');
  {
    const r = detectIntentAndRequirements(
      'is this available?',
      '',
      'Here is the Dell Vostro 3520 for ₹48,999.'
    );
    assert(r.intent === 'AVAILABILITY_QUERY', 'Intent: "is this available?" (1 active) → AVAILABILITY_QUERY', `Got: ${r.intent}`);
    assert(r.searchAllowed === false, 'searchAllowed is false', `Got: ${r.searchAllowed}`);
    assert(r.requirements.mentionedModels.some(m => m.toLowerCase().includes('vostro')), 'Target active model bound to requirements', `Got: ${r.requirements.mentionedModels}`);
  }

  // Test 3: "is this available?" with 2 active products -> CLARIFICATION (No arbitrary choice)
  console.log('\n--- Test 3: Ambiguous Availability Query (2 Active Products) ---');
  {
    const r = detectIntentAndRequirements(
      'is this available?',
      '',
      'We have the Dell Vostro 3520 (₹48,999) and Dell Inspiron 15 3530 (₹52,999).'
    );
    assert(r.intent === 'CLARIFICATION', 'Intent: "is this available?" (2 active) → CLARIFICATION', `Got: ${r.intent}`);
    assert(r.searchAllowed === false, 'searchAllowed is false', `Got: ${r.searchAllowed}`);
    assert(r.isClarification === true, 'isClarification is true', `Got: ${r.isClarification}`);
    assert(r.clarificationMessage && r.clarificationMessage.includes('Vostro') && r.clarificationMessage.includes('Inspiron'), 'Clarification mentions both products', `Got: ${r.clarificationMessage}`);
  }

  // Test 4: "show me Dell laptops" -> PRODUCT_SEARCH with brand=Dell
  console.log('\n--- Test 4: Explicit Search Evidence (Brand) ---');
  {
    const r = detectIntentAndRequirements('show me Dell laptops', '', '');
    assert(r.intent === 'PRODUCT_SEARCH', 'Intent: "show me Dell laptops" → PRODUCT_SEARCH', `Got: ${r.intent}`);
    assert(r.searchAllowed === true, 'searchAllowed is true', `Got: ${r.searchAllowed}`);
    assert(r.requirements.brand && r.requirements.brand.toLowerCase() === 'dell', 'Brand is Dell', `Got: ${r.requirements.brand}`);
  }

  // Test 5: "Dell under 50000" -> PRODUCT_SEARCH with brand=Dell & maxPrice=50000
  console.log('\n--- Test 5: Explicit Search Evidence (Brand + Budget) ---');
  {
    const r = detectIntentAndRequirements('Dell under 50000', '', '');
    assert(r.intent === 'PRODUCT_SEARCH', 'Intent: "Dell under 50000" → PRODUCT_SEARCH', `Got: ${r.intent}`);
    assert(r.searchAllowed === true, 'searchAllowed is true', `Got: ${r.searchAllowed}`);
    assert(r.requirements.brand && r.requirements.brand.toLowerCase() === 'dell', 'Brand is Dell', `Got: ${r.requirements.brand}`);
    assert(r.requirements.maxPrice === 50000, 'MaxPrice is 50000', `Got: ${r.requirements.maxPrice}`);
  }

  // Test 6: "what about delivery?" -> SHIPPING_QUERY / DELIVERY_QUERY, No PRODUCT_SEARCH
  console.log('\n--- Test 6: Policy Query Isolation ---');
  {
    const r = detectIntentAndRequirements(
      'what about delivery?',
      'CUSTOMER: "I want Dell laptops under 50000"',
      'Here are our Dell laptops under ₹50,000.'
    );
    assert(r.isPolicyQuery === true, 'isPolicyQuery is true', `Got: ${r.isPolicyQuery}`);
    assert(r.intent === 'SHIPPING_QUERY' || r.intent === 'DELIVERY_QUERY', 'Intent is SHIPPING_QUERY / DELIVERY_QUERY', `Got: ${r.intent}`);
    assert(r.searchAllowed === false, 'searchAllowed is false', `Got: ${r.searchAllowed}`);
    assert(r.requirements.brand === null, 'Brand is null (not leaked from history)', `Got: ${r.requirements.brand}`);
    assert(r.requirements.maxPrice === null, 'MaxPrice is null (not leaked from history)', `Got: ${r.requirements.maxPrice}`);
  }

  // Test 7: "what about warranty?" -> WARRANTY_QUERY, No PRODUCT_SEARCH
  console.log('\n--- Test 7: Warranty Query Isolation ---');
  {
    const r = detectIntentAndRequirements(
      'what about warranty?',
      'CUSTOMER: "I want Dell laptops under 50000"',
      'Here is the Dell Vostro 3520.'
    );
    assert(r.isPolicyQuery === true, 'isPolicyQuery is true', `Got: ${r.isPolicyQuery}`);
    assert(r.intent === 'WARRANTY_QUERY', 'Intent is WARRANTY_QUERY', `Got: ${r.intent}`);
    assert(r.searchAllowed === false, 'searchAllowed is false', `Got: ${r.searchAllowed}`);
    assert(r.requirements.mentionedModels.some(m => m.toLowerCase().includes('vostro')), 'Target model bound for warranty lookup', `Got: ${r.requirements.mentionedModels}`);
  }

  // Test 8: "yes" with single pending warranty action -> WARRANTY_QUERY
  console.log('\n--- Test 8: Single Pending Action Confirmation ---');
  {
    const r = detectIntentAndRequirements(
      'yes',
      '',
      'Here is the Lenovo IdeaPad Slim 3 for ₹38,999.\n\nWould you like me to check warranty details for the Lenovo IdeaPad Slim 3?'
    );
    assert(r.intent === 'WARRANTY_QUERY', 'Intent: "yes" (single warranty offer) → WARRANTY_QUERY', `Got: ${r.intent}`);
    assert(r.searchAllowed === false, 'searchAllowed is false', `Got: ${r.searchAllowed}`);
  }

  // Test 9: "yes" with multiple pending actions -> CLARIFICATION
  console.log('\n--- Test 9: Multiple Pending Actions Confirmation ---');
  {
    const r = detectIntentAndRequirements(
      'yes',
      '',
      'Here are the HP Pavilion 15 (₹65,999) and HP Victus 15 (₹68,999).\n\nWould you like me to compare any of these models or check warranty details?'
    );
    assert(r.intent === 'CLARIFICATION', 'Intent: "yes" (multiple offers) → CLARIFICATION', `Got: ${r.intent}`);
    assert(r.isClarification === true, 'isClarification is true', `Got: ${r.isClarification}`);
    assert(r.searchAllowed === false, 'searchAllowed is false', `Got: ${r.searchAllowed}`);
  }

  // Test 10: "compare them" with active products -> PRODUCT_COMPARISON
  console.log('\n--- Test 10: Active Product Comparison ---');
  {
    const r = detectIntentAndRequirements(
      'compare them',
      '',
      'Here are the HP Pavilion 15 (₹65,999) and HP Victus 15 (₹68,999).'
    );
    assert(r.intent === 'PRODUCT_COMPARISON', 'Intent: "compare them" → PRODUCT_COMPARISON', `Got: ${r.intent}`);
    assert(r.isComparison === true, 'isComparison is true', `Got: ${r.isComparison}`);
    assert(r.requirements.mentionedModels.length >= 2, 'Both active models bound', `Got: ${r.requirements.mentionedModels}`);
  }

  // Test 11: "what about this?" with 2 active products -> CLARIFICATION
  console.log('\n--- Test 11: Ambiguous Referential Pronoun (2 Products) ---');
  {
    const r = detectIntentAndRequirements(
      'what about this?',
      '',
      'Here are the HP Pavilion 15 (₹65,999) and HP Victus 15 (₹68,999).'
    );
    assert(r.intent === 'CLARIFICATION', 'Intent: "what about this?" (2 products) → CLARIFICATION', `Got: ${r.intent}`);
    assert(r.searchAllowed === false, 'searchAllowed is false', `Got: ${r.searchAllowed}`);
    assert(r.isClarification === true, 'isClarification is true', `Got: ${r.isClarification}`);
  }

  // Test 12: "what about this?" with 1 active product -> PRODUCT_SEARCH on that active product
  console.log('\n--- Test 12: Unambiguous Referential Pronoun (1 Product) ---');
  {
    const r = detectIntentAndRequirements(
      'what about this?',
      '',
      'Here is the HP Pavilion 15 for ₹65,999.'
    );
    assert(r.intent === 'PRODUCT_SEARCH', 'Intent: "what about this?" (1 product) → PRODUCT_SEARCH', `Got: ${r.intent}`);
    assert(r.searchAllowed === true, 'searchAllowed is true', `Got: ${r.searchAllowed}`);
    assert(r.requirements.mentionedModels.some(m => m.toLowerCase().includes('pavilion')), 'Target model resolved', `Got: ${r.requirements.mentionedModels}`);
  }

  // Test 13: Historical requirements alone MUST NOT trigger PRODUCT_SEARCH for ambiguous current turn
  console.log('\n--- Test 13: Historical Requirements Isolation on Ambiguous Turn ---');
  {
    const conversationHistory = 'CUSTOMER: "Dell laptops under 50000"\nASSISTANT: "Here are our Dell laptops under ₹50,000: Dell Vostro 3520, Dell Inspiron 15 3530."';
    const r = detectIntentAndRequirements('is this available to you', conversationHistory, 'Standard delivery takes 3 to 7 days.');
    assert(r.intent === 'CLARIFICATION', 'Historical Dell requirements DO NOT trigger search for "is this available to you"', `Got: ${r.intent}`);
    assert(r.searchAllowed === false, 'searchAllowed is false', `Got: ${r.searchAllowed}`);
    assert(r.requirements.brand === null, 'Brand is not inherited (null)', `Got: ${r.requirements.brand}`);
    assert(r.requirements.maxPrice === null, 'MaxPrice is not inherited (null)', `Got: ${r.requirements.maxPrice}`);
  }

  // Test 14: RAG Pipeline Search Safety Gate
  console.log('\n--- Test 14: RAG Pipeline Search Safety Gate ---');
  {
    const rag = await executeRagRetrieval(
      'is this available to you',
      'CUSTOMER: "Dell under 50000"',
      'Standard delivery takes 3-7 days.'
    );
    assert(rag.intent === 'CLARIFICATION', 'RAG Intent is CLARIFICATION', `Got: ${rag.intent}`);
    assert(rag.isClarification === true, 'RAG isClarification is true', `Got: ${rag.isClarification}`);
    assert(rag.rawProducts.length === 0, 'RAG rawProducts is empty (0 products retrieved)', `Got: ${rag.rawProducts.length}`);
    assert(rag.clarificationMessage && rag.clarificationMessage.length > 0, 'Clarification message present', `Got: ${rag.clarificationMessage}`);
  }

  // Test 15: Full Production Failure Exact Flow Simulation
  console.log('\n--- Test 15: Exact Production Failure Scenario ---');
  {
    // Conversation turns:
    // Turn 1: CUSTOMER: "delivery details" -> ASSISTANT: "Standard doorstep delivery across India takes 3 to 7 business days..."
    // Turn 2: CUSTOMER: "emi poecces" -> ASSISTANT: "Yes! We offer flexible No-Cost EMI options..."
    // Turn 3: CUSTOMER: "is this available to you"
    const history = 'CUSTOMER: "delivery details"\nASSISTANT: "Standard doorstep delivery across India takes 3 to 7 business days."\nCUSTOMER: "emi poecces"\nASSISTANT: "Yes! We offer flexible No-Cost EMI options."';
    const lastAssistant = 'Yes! We offer flexible No-Cost EMI options on major credit cards.';

    const response = await generateAiResponse('is this available to you', '', history, lastAssistant);

    assert(response.responseSource !== 'UNKNOWN', 'Response source is NEVER UNKNOWN', `Got: ${response.responseSource}`);
    assert(response.responseSource === 'DETERMINISTIC_FALLBACK' || response.responseSource === 'CLARIFICATION', 'Response source is DETERMINISTIC_FALLBACK', `Got: ${response.responseSource}`);
    assert(!response.reply.toLowerCase().includes('dell laptops under'), 'Reply DOES NOT invent Dell laptops', `Got: ${response.reply}`);
    assert(!response.reply.toLowerCase().includes('here are the available'), 'Reply DOES NOT produce fake product list', `Got: ${response.reply}`);
    assert(response.reply.toLowerCase().includes('clarify') || response.reply.toLowerCase().includes('what') || response.reply.toLowerCase().includes('options'), 'Reply asks for clarification', `Got: ${response.reply}`);
  }

  // Test 16: Availability Query Deterministic Output (1 Active Product)
  console.log('\n--- Test 16: Availability Query Response Generation ---');
  {
    const response = await generateAiResponse(
      'is this available?',
      '',
      'CUSTOMER: "show me Dell Vostro"',
      'Here is the Dell Vostro 3520 for ₹48,999.'
    );
    assert(response.responseSource === 'PRODUCT_RAG' || response.responseSource === 'GEMINI_WITH_PRODUCT_RAG' || response.responseSource === 'DETERMINISTIC_FALLBACK', 'Response source is valid', `Got: ${response.responseSource}`);
    assert(response.reply.toLowerCase().includes('vostro') && response.reply.toLowerCase().includes('stock'), 'Reply confirms Dell Vostro stock status', `Got: ${response.reply}`);
  }

  console.log('\n--------------------------------------------------');
  console.log(`Ambiguity Gate Summary: \x1b[32m${passed} Passed\x1b[0m, \x1b[31m${failed} Failed\x1b[0m`);
  console.log('--------------------------------------------------\n');

  if (failed > 0) process.exit(1);
}

runAmbiguityGateTests();
