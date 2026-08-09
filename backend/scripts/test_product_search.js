import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

process.env.RAG_TEST_MODE = 'true';
dotenv.config({ path: path.resolve(__dirname, '../.env') });

import { searchProducts } from '../services/productSearchService.js';

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

async function runProductSearchTests() {
  console.log('\n==================================================');
  console.log('🧪 RUNNING PRODUCT SEARCH / RETRIEVAL UNIT TESTS');
  console.log('⚡ (Offline - No Gemini API Calls)');
  console.log('==================================================\n');

  // 1. HP Laptops
  const hpResults = await searchProducts({ brand: 'HP', limit: 10 });
  assert(
    hpResults.length > 0 && hpResults.every((p) => p.brand.toLowerCase() === 'hp'),
    'Product Search: HP laptops',
    `Found ${hpResults.length} HP models`
  );

  // 2. Lenovo Laptops
  const lenovoResults = await searchProducts({ brand: 'Lenovo', limit: 10 });
  assert(
    lenovoResults.length > 0 && lenovoResults.every((p) => p.brand.toLowerCase() === 'lenovo'),
    'Product Search: Lenovo laptops',
    `Found ${lenovoResults.length} Lenovo models`
  );

  // 3. Laptops under ₹70,000
  const under70k = await searchProducts({ maxPrice: 70000, limit: 10 });
  assert(
    under70k.length > 0 && under70k.every((p) => p.price <= 70000),
    'Product Search: Laptops under ₹70,000',
    `Found ${under70k.length} models <= ₹70,000`
  );

  // 4. 16GB RAM Laptops
  const ram16Results = await searchProducts({ ram: '16GB', limit: 10 });
  assert(
    ram16Results.length > 0 && ram16Results.every((p) => p.ram.includes('16GB')),
    'Product Search: 16GB RAM laptops',
    `Found ${ram16Results.length} models with 16GB RAM`
  );

  // 5. Coding Laptops
  const codingResults = await searchProducts({ useCase: 'coding', limit: 10 });
  assert(
    codingResults.length > 0 && codingResults.some((p) => p.useCases.includes('coding')),
    'Product Search: Coding / developer laptops',
    `Found ${codingResults.length} coding-optimized models`
  );

  // 6. In-stock products
  const inStockResults = await searchProducts({ inStockOnly: true, limit: 10 });
  assert(
    inStockResults.length > 0 && inStockResults.every((p) => p.availability === 'in_stock'),
    'Product Search: In-stock products filter',
    `Found ${inStockResults.length} in-stock models`
  );

  // 7. Combined Query: HP + 16GB + Coding
  const combinedResults = await searchProducts({
    brand: 'HP',
    ram: '16GB',
    useCase: 'coding',
    limit: 5
  });
  assert(
    combinedResults.length > 0 &&
      combinedResults.every((p) => p.brand === 'HP' && p.ram.includes('16GB')),
    'Product Search: HP + 16GB RAM + Coding',
    `Top match: ${combinedResults[0]?.brand} ${combinedResults[0]?.model} (₹${combinedResults[0]?.price})`
  );

  // 8. Nonexistent Product
  const emptyResults = await searchProducts({
    brand: 'NonExistentBrand12345',
    keyword: 'AlienSuperQuantumLaptopXYZ'
  });
  assert(
    emptyResults.length === 0,
    'Product Search: Nonexistent product graceful handling',
    'Returned 0 results as expected'
  );

  console.log('\n--------------------------------------------------');
  console.log(`Product Tests Summary: \x1b[32m${passed} Passed\x1b[0m, \x1b[31m${failed} Failed\x1b[0m`);
  console.log('--------------------------------------------------\n');

  if (failed > 0) process.exit(1);
}

runProductSearchTests().catch((err) => {
  console.error('Test execution error:', err);
  process.exit(1);
});
