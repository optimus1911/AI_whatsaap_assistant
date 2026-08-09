import { spawn } from 'child_process';
import http from 'http';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const TEST_PORT = 19876; // Unlikely to conflict
let passed = 0;
let failed = 0;

function assert(condition, label) {
  if (condition) {
    console.log(`  ✓ PASS: ${label}`);
    passed++;
  } else {
    console.log(`  ✗ FAIL: ${label}`);
    failed++;
  }
}

function httpGet(urlPath) {
  return new Promise((resolve, reject) => {
    const req = http.get(`http://127.0.0.1:${TEST_PORT}${urlPath}`, (res) => {
      let data = '';
      res.on('data', (chunk) => (data += chunk));
      res.on('end', () => {
        try {
          resolve({ status: res.statusCode, body: JSON.parse(data) });
        } catch {
          resolve({ status: res.statusCode, body: data });
        }
      });
    });
    req.on('error', reject);
    req.setTimeout(5000, () => {
      req.destroy();
      reject(new Error('Request timeout'));
    });
  });
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

console.log('================================================================');
console.log('🧪 DEPLOYMENT HEALTH REGRESSION TEST');
console.log(`⚡ Testing server startup on port ${TEST_PORT}`);
console.log('================================================================\n');

// Spawn server.js with a custom PORT
const serverPath = path.resolve(__dirname, '..', 'server.js');
const child = spawn(process.execPath, [serverPath], {
  env: {
    ...process.env,
    PORT: String(TEST_PORT),
    NODE_ENV: 'test',
    // Don't require a real MongoDB for this test
    MONGODB_URI: '',
  },
  stdio: ['pipe', 'pipe', 'pipe'],
  cwd: path.resolve(__dirname, '..'),
});

let stdout = '';
let stderr = '';

child.stdout.on('data', (data) => {
  stdout += data.toString();
});
child.stderr.on('data', (data) => {
  stderr += data.toString();
});

let childExited = false;
child.on('exit', (code) => {
  childExited = true;
});

async function runTests() {
  // Wait for the server to output listen confirmation (up to 8 seconds)
  let listenDetected = false;
  for (let i = 0; i < 40; i++) {
    await sleep(200);
    if (stdout.includes(`listening on port ${TEST_PORT}`) || stdout.includes(`port ${TEST_PORT}`)) {
      listenDetected = true;
      break;
    }
    if (childExited) break;
  }

  // Test 1: Server started and emitted listen log
  assert(listenDetected, `Server emitted listen log on port ${TEST_PORT}`);

  // Test 2: Process is still alive
  assert(!childExited, 'Server process is still running (did not exit)');

  // Test 3: GET /health returns 200
  try {
    const healthRes = await httpGet('/health');
    assert(healthRes.status === 200, `/health returns HTTP 200 (got ${healthRes.status})`);
    assert(healthRes.body && healthRes.body.status === 'UP', `/health body.status === "UP"`);
  } catch (err) {
    assert(false, `/health reachable (error: ${err.message})`);
    assert(false, `/health body.status === "UP" (skipped)`);
  }

  // Test 4: GET /api/diagnostics returns 200
  try {
    const diagRes = await httpGet('/api/diagnostics');
    assert(diagRes.status === 200, `/api/diagnostics returns HTTP 200 (got ${diagRes.status})`);
    assert(diagRes.body && diagRes.body.success !== undefined, `/api/diagnostics returns JSON with success field`);
  } catch (err) {
    assert(false, `/api/diagnostics reachable (error: ${err.message})`);
    assert(false, `/api/diagnostics returns JSON (skipped)`);
  }

  // Test 5: GET / (root health) returns 200
  try {
    const rootRes = await httpGet('/');
    assert(rootRes.status === 200, `/ root endpoint returns HTTP 200 (got ${rootRes.status})`);
  } catch (err) {
    assert(false, `/ root endpoint reachable (error: ${err.message})`);
  }

  // Test 6: Process STILL alive after requests
  await sleep(500);
  assert(!childExited, 'Server process still alive after handling requests');

  // Test 7: Root package.json "start" script resolves to server.js (not a test runner)
  try {
    const { readFileSync } = await import('fs');
    const rootPkg = JSON.parse(readFileSync(path.resolve(__dirname, '..', '..', 'package.json'), 'utf-8'));
    const startScript = rootPkg.scripts && rootPkg.scripts.start;
    assert(startScript && startScript.includes('server.js'), `Root package.json "start" runs server.js (value: "${startScript}")`);
    assert(startScript && !startScript.includes('test'), `Root package.json "start" does NOT run a test script`);
  } catch (err) {
    assert(false, `Root package.json readable (error: ${err.message})`);
    assert(false, `Root package.json start script check (skipped)`);
  }

  // Cleanup
  child.kill('SIGTERM');
  await sleep(500);
  if (!childExited) child.kill('SIGKILL');

  console.log(`\n----------------------------------------------------------------`);
  console.log(`Deployment Health Summary: ${passed} Passed, ${failed} Failed`);
  console.log(`----------------------------------------------------------------\n`);

  if (stdout) {
    console.log('--- Server stdout (first 800 chars) ---');
    console.log(stdout.substring(0, 800));
  }
  if (stderr && stderr.trim()) {
    console.log('--- Server stderr (first 400 chars) ---');
    console.log(stderr.substring(0, 400));
  }

  process.exit(failed > 0 ? 1 : 0);
}

runTests().catch((err) => {
  console.error('Test runner error:', err);
  child.kill('SIGKILL');
  process.exit(1);
});
