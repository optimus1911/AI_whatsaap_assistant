import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

process.env.RAG_TEST_MODE = 'true';
dotenv.config({ path: path.resolve(__dirname, '../.env') });

import { searchBusinessKnowledge } from '../services/businessKnowledgeService.js';

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

async function runBusinessKnowledgeTests() {
  console.log('\n==================================================');
  console.log('🧪 RUNNING BUSINESS KNOWLEDGE / POLICY UNIT TESTS');
  console.log('⚡ (Offline - No Gemini API Calls)');
  console.log('==================================================\n');

  // 1. Return Policy
  const returnPolicy = await searchBusinessKnowledge({ category: 'returns', query: 'return policy', limit: 2 });
  assert(
    returnPolicy.length > 0 && returnPolicy[0].content.includes('7 days'),
    'Business Knowledge: Return Policy',
    '7 days return window retrieved'
  );

  // 2. Refund Policy
  const refundPolicy = await searchBusinessKnowledge({ category: 'refunds', query: 'refund timeline', limit: 2 });
  assert(
    refundPolicy.length > 0 && refundPolicy[0].content.includes('5–7 business days'),
    'Business Knowledge: Refund Policy',
    '5–7 days refund timeline retrieved'
  );

  // 3. Exchange Policy
  const exchangePolicy = await searchBusinessKnowledge({ category: 'exchanges', query: 'product replacement', limit: 2 });
  assert(
    exchangePolicy.length > 0 && (exchangePolicy[0].category === 'exchanges' || exchangePolicy[0].content.includes('replacement')),
    'Business Knowledge: Exchange Policy',
    'Hardware exchange / replacement retrieved'
  );

  // 4. Warranty Policy
  const warrantyPolicy = await searchBusinessKnowledge({ category: 'warranty', query: 'warranty coverage', limit: 2 });
  assert(
    warrantyPolicy.length > 0 && warrantyPolicy[0].content.includes('1-Year'),
    'Business Knowledge: Manufacturer Warranty',
    '1-year brand warranty retrieved'
  );

  // 5. Shipping Policy
  const shippingPolicy = await searchBusinessKnowledge({ category: 'shipping', query: 'delivery time', limit: 2 });
  assert(
    shippingPolicy.length > 0 && shippingPolicy[0].content.includes('3 to 7 business days'),
    'Business Knowledge: Shipping Timelines',
    '3–7 business days delivery retrieved'
  );

  // 6. EMI Availability
  const emiPolicy = await searchBusinessKnowledge({ category: 'payment', query: 'No-Cost EMI', limit: 2 });
  assert(
    emiPolicy.length > 0 && emiPolicy.some((p) => p.content.includes('EMI')),
    'Business Knowledge: EMI Availability',
    'No-Cost EMI 3 & 6 months retrieved'
  );

  // 7. Cash on Delivery (COD)
  const codPolicy = await searchBusinessKnowledge({ category: 'payment', query: 'cash on delivery COD', limit: 2 });
  assert(
    codPolicy.length > 0 && codPolicy.some((p) => p.content.includes('50,000')),
    'Business Knowledge: Cash on Delivery limit',
    'COD up to ₹50,000 retrieved'
  );

  // 8. Order Cancellation
  const cancelPolicy = await searchBusinessKnowledge({ category: 'cancellation', query: 'cancel order', limit: 2 });
  assert(
    cancelPolicy.length > 0 && cancelPolicy[0].content.includes('before shipment'),
    'Business Knowledge: Order Cancellation',
    'Pre-dispatch cancellation retrieved'
  );

  // 9. Damaged Product Policy
  const damagedPolicy = await searchBusinessKnowledge({ category: 'support', query: 'damaged product in transit', limit: 2 });
  assert(
    damagedPolicy.length > 0 && (damagedPolicy[0].category === 'support' || damagedPolicy[0].content.includes('damaged')),
    'Business Knowledge: Damaged in transit policy',
    '48h damage reporting & replacement retrieved'
  );

  // 10. Student Discount
  const studentPolicy = await searchBusinessKnowledge({ category: 'discounts', query: 'student discount', limit: 2 });
  assert(
    studentPolicy.length > 0 && studentPolicy[0].content.includes('5%'),
    'Business Knowledge: Student Discount Policy',
    '5% educational discount retrieved'
  );

  console.log('\n--------------------------------------------------');
  console.log(`Knowledge Tests Summary: \x1b[32m${passed} Passed\x1b[0m, \x1b[31m${failed} Failed\x1b[0m`);
  console.log('--------------------------------------------------\n');

  if (failed > 0) process.exit(1);
}

runBusinessKnowledgeTests().catch((err) => {
  console.error('Test execution error:', err);
  process.exit(1);
});
