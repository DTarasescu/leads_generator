#!/usr/bin/env node
// smoke-leads.mjs — Smoke test for leads_generator API
// Usage: node scripts/smoke-leads.mjs [BASE_URL]
// Requires Node 18+

const BASE = process.argv[2] || process.env.NEXT_PUBLIC_APP_BASE || "http://localhost:3400";

let pass = 0, fail = 0;

async function check(name, fn) {
  try {
    await fn();
    console.log(`  PASS  ${name}`);
    pass++;
  } catch (err) {
    console.log(`  FAIL  ${name}: ${err.message}`);
    fail++;
  }
}

function assert(cond, msg) {
  if (!cond) throw new Error(msg);
}

console.log(`\nSmoke test → ${BASE}\n`);

// 1. Health check
await check("GET /api/health → 200 + status:ok", async () => {
  const r = await fetch(`${BASE}/api/health`);
  assert(r.status === 200, `Expected 200, got ${r.status}`);
  const d = await r.json();
  assert(d.status === "ok", `Expected status:ok, got ${JSON.stringify(d)}`);
  assert(d.service === "leads-generator", `Expected service:leads-generator, got ${d.service}`);
});

// 2. Leads list without auth → 401
await check("GET /api/leads (no auth) → 401", async () => {
  const r = await fetch(`${BASE}/api/leads`);
  assert(r.status === 401, `Expected 401, got ${r.status}`);
});

// 3. Create lead without auth → 401
await check("POST /api/leads (no auth) → 401", async () => {
  const r = await fetch(`${BASE}/api/leads`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ name: "Test", email: "test@test.com" }),
  });
  assert(r.status === 401, `Expected 401, got ${r.status}`);
});

// 4. Generate message without auth → 401
await check("POST /api/generate-message (no auth) → 401", async () => {
  const r = await fetch(`${BASE}/api/generate-message`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ name: "Test", business_type: "gym" }),
  });
  assert(r.status === 401, `Expected 401, got ${r.status}`);
});

// 5. Score lead without auth → 401
await check("POST /api/score-lead (no auth) → 401", async () => {
  const r = await fetch(`${BASE}/api/score-lead`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ business_name: "Test", business_type: "gym" }),
  });
  assert(r.status === 401, `Expected 401, got ${r.status}`);
});

// 6. Capture lead with invalid data → 400
await check("POST /api/capture-lead (missing fields) → 400", async () => {
  const r = await fetch(`${BASE}/api/capture-lead`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ name: "X" }), // missing email + city + business_type
  });
  assert(r.status === 400, `Expected 400, got ${r.status}`);
});

// 7. Health endpoint method check
await check("POST /api/health → 405", async () => {
  const r = await fetch(`${BASE}/api/health`, { method: "POST" });
  assert(r.status === 405, `Expected 405, got ${r.status}`);
});

console.log(`\n${pass + fail} checks: ${pass} passed, ${fail} failed\n`);
if (fail) process.exit(1);
