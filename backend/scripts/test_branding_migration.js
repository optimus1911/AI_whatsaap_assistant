import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

process.env.RAG_TEST_MODE = 'true';
dotenv.config({ path: path.resolve(__dirname, '../.env') });

import { sanitizeCustomerReply, generateAiResponse } from '../services/geminiService.js';
import { buildGreetingResponse, buildCapabilityResponse } from '../services/deterministicResponseService.js';

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

async function runBrandingAudit() {
  console.log('\n========================================================================');
  console.log('🔍 BRANDING MIGRATION AUDIT: SALES-PILOT -> AI WHATSAPP ASSISTANT');
  console.log('========================================================================\n');

  const rootDir = path.resolve(__dirname, '../../');

  // 1. Static Scan: Frontend components
  console.log('--- 1. Static Frontend Scan ---');
  const frontendFiles = [
    'src/components/chat/Sidebar.jsx',
    'src/components/chat/ChatArea.jsx',
    'src/components/dashboard/DashboardFooter.jsx',
    'index.html'
  ];

  for (const relPath of frontendFiles) {
    const fullPath = path.join(rootDir, relPath);
    if (fs.existsSync(fullPath)) {
      const content = fs.readFileSync(fullPath, 'utf8');
      const hasOldBrand = /SalesPilot/i.test(content);
      assert(
        !hasOldBrand,
        `No "SalesPilot" branding in ${relPath}`,
        hasOldBrand ? `Found match in ${relPath}` : ''
      );
    }
  }

  // 2. Static Scan: Backend source code
  console.log('\n--- 2. Static Backend Scan ---');
  const backendFiles = [
    'backend/app.js',
    'backend/server.js',
    'backend/models/Product.js',
    'backend/services/geminiService.js',
    'backend/services/deterministicResponseService.js',
    'backend/services/intentService.js',
    'backend/services/ragService.js'
  ];

  for (const relPath of backendFiles) {
    const fullPath = path.join(rootDir, relPath);
    if (fs.existsSync(fullPath)) {
      const content = fs.readFileSync(fullPath, 'utf8');
      // For geminiService.js, sanitizer regex replaces SalesPilot, which is allowed in regex pattern
      let checkContent = content;
      if (relPath.includes('geminiService.js')) {
        checkContent = content.replace(/\.replace\(\/\\bSalesPilot[^\)]+\)/g, '');
      }
      const hasOldBrand = /SalesPilot\s*AI|SalesPilot-AI|SalesPilot\s*CRM|SalesPilot\s*Intelligence/i.test(checkContent);
      assert(
        !hasOldBrand,
        `No "SalesPilot" user-facing branding in ${relPath}`,
        hasOldBrand ? `Found match in ${relPath}` : ''
      );
    }
  }

  // 3. Runtime Response Verification
  console.log('\n--- 3. Runtime Response Verification ---');
  const greeting = buildGreetingResponse();
  assert(
    greeting.includes('AI WhatsApp Assistant') && !greeting.includes('SalesPilot'),
    'buildGreetingResponse() contains "AI WhatsApp Assistant" and no "SalesPilot"',
    `Greeting: "${greeting}"`
  );

  const capability = buildCapabilityResponse();
  assert(
    !capability.includes('SalesPilot'),
    'buildCapabilityResponse() has no "SalesPilot"',
    `Capability: "${capability}"`
  );

  const sanitizedWithOldBrand = sanitizeCustomerReply('Hello! Welcome to SalesPilot AI. We have great deals at SalesPilot!');
  assert(
    !sanitizedWithOldBrand.includes('SalesPilot') && sanitizedWithOldBrand.includes('AI WhatsApp Assistant'),
    'sanitizeCustomerReply() cleanses any legacy "SalesPilot" from LLM output',
    `Sanitized: "${sanitizedWithOldBrand}"`
  );

  // 4. Live Pipeline Responses
  console.log('\n--- 4. Live Response Pipeline Verification ---');
  const liveGreeting = await generateAiResponse('hi');
  assert(
    !liveGreeting.reply.includes('SalesPilot') && liveGreeting.reply.includes('AI WhatsApp Assistant'),
    'generateAiResponse("hi") produces clean AI WhatsApp Assistant greeting',
    `Reply: "${liveGreeting.reply}"`
  );

  console.log('\n------------------------------------------------------------------------');
  console.log(`Branding Audit Summary: \x1b[32m${passed} Passed\x1b[0m, \x1b[31m${failed} Failed\x1b[0m`);
  console.log('========================================================================\n');

  process.exitCode = failed === 0 ? 0 : 1;
}

runBrandingAudit();
