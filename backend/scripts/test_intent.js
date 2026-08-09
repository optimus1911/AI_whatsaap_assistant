import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

process.env.RAG_TEST_MODE = 'true';
dotenv.config({ path: path.resolve(__dirname, '../.env') });

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

function runIntentTests() {
  console.log('\n==================================================');
  console.log('🧪 RUNNING INTENT DETECTION & EXTRACTION UNIT TESTS');
  console.log('⚡ (Offline - No Gemini API Calls)');
  console.log('==================================================\n');

  // 1. "Which laptop did I ask about?"
  const t1 = detectIntentAndRequirements(
    'Which laptop did I ask about?',
    'CUSTOMER: "I want an HP laptop with 16GB RAM for coding."'
  );
  assert(
    t1.intent === 'HISTORICAL_QUERY' && t1.isHistoricalQuery === true,
    'Intent: "Which laptop did I ask about?"',
    `Detected: ${t1.intent}`
  );

  // 2. "yes" (with assistant offer in context)
  const t2 = detectIntentAndRequirements(
    'yes',
    'CUSTOMER: "I want an HP laptop."',
    'Would you like me to show available HP laptops with 16GB RAM?'
  );
  assert(
    t2.intent === 'CONFIRMATION' && t2.isConfirmation === true && t2.requirements.brand === 'HP',
    'Intent: "yes" (Contextual Confirmation)',
    `Detected: ${t2.intent}, Inferred Brand: ${t2.requirements.brand}, RAM: ${t2.requirements.ram}`
  );

  // 3. "show me"
  const t3 = detectIntentAndRequirements(
    'show me',
    'CUSTOMER: "I need a Lenovo laptop for college."',
    'Should I show you the available Lenovo laptops for student use?'
  );
  assert(
    t3.intent === 'CONFIRMATION' && t3.isConfirmation === true && t3.requirements.brand === 'Lenovo',
    'Intent: "show me" (Confirmation)',
    `Detected: ${t3.intent}, Brand: ${t3.requirements.brand}`
  );

  // 4. "compare them"
  const t4 = detectIntentAndRequirements(
    'compare them',
    'ASSISTANT: "We have HP Pavilion 15 and HP ProBook 440."'
  );
  assert(
    t4.intent === 'PRODUCT_COMPARISON' && t4.isComparison === true,
    'Intent: "compare them" (Product Comparison)',
    `Detected: ${t4.intent}, Mentioned models: ${t4.requirements.mentionedModels.join(', ')}`
  );

  // 5. "what RAM did I want?"
  const t5 = detectIntentAndRequirements(
    'what RAM did I want?',
    'CUSTOMER: "I want 16GB RAM for coding."'
  );
  assert(
    t5.intent === 'HISTORICAL_QUERY' && t5.isHistoricalQuery === true,
    'Intent: "what RAM did I want?" (Memory Query)',
    `Detected: ${t5.intent}`
  );

  // 6. "what is the return policy?"
  const t6 = detectIntentAndRequirements("what is the return policy?");
  assert(
    t6.intent === 'RETURN_POLICY' && t6.policyCategory === 'returns',
    'Intent: "what is the return policy?" (Policy Query)',
    `Detected: ${t6.intent}, Category: ${t6.policyCategory}`
  );

  // 7. "laptops under 70000"
  const t7 = detectIntentAndRequirements('laptops under 70000');
  assert(
    t7.intent === 'PRODUCT_SEARCH' && t7.requirements.maxPrice === 70000,
    'Intent: "laptops under 70000" (Budget Filter)',
    `Detected: ${t7.intent}, MaxPrice: ₹${t7.requirements.maxPrice}`
  );

  // 8. "HP laptops"
  const t8 = detectIntentAndRequirements('HP laptops');
  assert(
    t8.intent === 'PRODUCT_SEARCH' && t8.requirements.brand === 'HP',
    'Intent: "HP laptops" (Brand Filter)',
    `Detected: ${t8.intent}, Brand: ${t8.requirements.brand}`
  );

  // 9. "that one"
  const t9 = detectIntentAndRequirements(
    'that one',
    'ASSISTANT: "Here is the HP Pavilion 15 for ₹65,999."'
  );
  assert(
    t9.intent === 'PRODUCT_SEARCH' && t9.requirements.brand === 'HP',
    'Intent: "that one" (Pronoun Resolution)',
    `Detected: ${t9.intent}, Inferred Brand: ${t9.requirements.brand}`
  );

  // 10. "its price"
  const t10 = detectIntentAndRequirements(
    'its price',
    'CUSTOMER: "Tell me about HP Pavilion 15."'
  );
  assert(
    t10.intent === 'PRICE_QUERY',
    'Intent: "its price" (Price Query)',
    `Detected: ${t10.intent}, Brand: ${t10.requirements.brand || 'Inherited'}`
  );

  // 11. "that laptop"
  const t11 = detectIntentAndRequirements(
    'that laptop',
    '',
    'Here is the Lenovo IdeaPad Slim 3 for ₹38,999.'
  );
  assert(
    t11.intent === 'PRODUCT_SEARCH' && t11.requirements.brand === 'Lenovo',
    'Intent: "that laptop" (Pronoun Resolution with Lenovo)',
    `Detected: ${t11.intent}, Brand: ${t11.requirements.brand}`
  );

  // 12. "this one"
  const t12 = detectIntentAndRequirements(
    'this one',
    '',
    'Here is the Dell Inspiron 15 for ₹52,999.'
  );
  assert(
    t12.intent === 'PRODUCT_SEARCH' && t12.requirements.brand === 'Dell',
    'Intent: "this one" (Pronoun Resolution with Dell)',
    `Detected: ${t12.intent}, Brand: ${t12.requirements.brand}`
  );

  // 13. "show me that one"
  const t13 = detectIntentAndRequirements(
    'show me that one',
    '',
    'Here is the HP Victus 15 for ₹68,999.'
  );
  assert(
    t13.intent === 'PRODUCT_SEARCH' && t13.requirements.brand === 'HP',
    'Intent: "show me that one" (Pronoun Resolution)',
    `Detected: ${t13.intent}, Brand: ${t13.requirements.brand}`
  );

  // 14. "its warranty"
  const t14 = detectIntentAndRequirements(
    'its warranty',
    '',
    'Here is the Lenovo IdeaPad Slim 3 for ₹38,999.'
  );
  assert(
    t14.intent === 'WARRANTY_QUERY' && t14.isPolicyQuery === true,
    'Intent: "its warranty" (Contextual Warranty Query)',
    `Detected: ${t14.intent}`
  );

  // 15. "compare it with Dell" with Lenovo in context
  const t15 = detectIntentAndRequirements(
    'compare it with Dell',
    'CUSTOMER: "Lenovo under 50000"\nASSISTANT: "Here are the Lenovo laptops: Lenovo IdeaPad Slim 3"',
    'Here is the Lenovo IdeaPad Slim 3 for ₹38,999.'
  );
  assert(
    t15.intent === 'PRODUCT_COMPARISON' && t15.isComparison === true &&
    t15.requirements.mentionedModels.some(m => m.toLowerCase().includes('lenovo')) &&
    t15.requirements.mentionedModels.some(m => m.toLowerCase().includes('dell')),
    'Intent: "compare it with Dell" (Cross-Brand Comparison with Lenovo Active)',
    `Detected: ${t15.intent}, Models: ${t15.requirements.mentionedModels.join(', ')}`
  );

  // 16. "what about warranty?"
  const t16 = detectIntentAndRequirements(
    'what about warranty?',
    '',
    'The Lenovo IdeaPad Slim 3 is available for ₹38,999.'
  );
  assert(
    t16.intent === 'WARRANTY_QUERY' && t16.isPolicyQuery === true,
    'Intent: "what about warranty?" (Targeted Warranty Policy)',
    `Detected: ${t16.intent}`
  );

  console.log('\n--------------------------------------------------');
  console.log(`Intent Tests Summary: \x1b[32m${passed} Passed\x1b[0m, \x1b[31m${failed} Failed\x1b[0m`);
  console.log('--------------------------------------------------\n');

  if (failed > 0) process.exit(1);
}

runIntentTests();
