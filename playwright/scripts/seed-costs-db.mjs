#!/usr/bin/env node
// Deterministic seeder for the cost-dashboard capture (llm/cost-controls/dashboard.md).
//
// Writes a populated `request_logs` SQLite database so the Admin UI Costs/Analytics pages
// render a rich, blog-style dashboard without sending live traffic. The row MAGNITUDES are
// deterministic (a fixed-seed LCG, no Math.random), so per-group cost/token breakdowns are
// identical every run; only the absolute timestamps track "now" so the rows always land in
// the dashboard's default 24h window.
//
// Usage: node seed-costs-db.mjs <path-to-db>
// Emits SQL to stdout when no path is given (pipe to `sqlite3 db`); otherwise writes the DB
// directly via the sqlite3 CLI.
import { execFileSync } from 'node:child_process';
import { writeFileSync } from 'node:fs';

const NOW = process.env.SEED_NOW_MS ? Number(process.env.SEED_NOW_MS) : Date.now();

// Fixed-seed LCG → deterministic magnitudes across runs.
let s = 20260702;
const rnd = () => (s = (s * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff;
const pick = (a) => a[Math.floor(rnd() * a.length)];

// Rates are USD per 1M tokens; used only to compute a realistic per-row cost.
const MODELS = [
  { p: 'openai', m: 'gpt-4o', in: 2.5, out: 10 },
  { p: 'openai', m: 'gpt-4o-mini', in: 0.15, out: 0.6 },
  { p: 'anthropic', m: 'claude-3-5-sonnet', in: 3, out: 15 },
  { p: 'google', m: 'gemini-2.5-pro', in: 1.25, out: 10 },
  { p: 'bedrock', m: 'claude-3-haiku', in: 0.25, out: 1.25 },
];
const USERS = ['alice', 'bob', 'carol', 'dave'];
const GROUPS = ['platform', 'research', 'support'];
const AGENTS = ['Cursor', 'Claude Code', 'openai-python', 'codex'];

const N = Number(process.env.SEED_ROWS || 800);
const WINDOW_MS = 23 * 3600 * 1000; // keep inside the default 24h view
const iso = (ms) => new Date(ms).toISOString().replace('Z', '+00:00');
const esc = (o) => JSON.stringify(o).replace(/'/g, "''");

const rows = [];
for (let i = 0; i < N; i++) {
  const md = pick(MODELS);
  const inTok = 200 + Math.floor(rnd() * 4000);
  const outTok = 50 + Math.floor(rnd() * 1500);
  const cost = (inTok / 1e6) * md.in + (outTok / 1e6) * md.out;
  const startMs = NOW - Math.floor(rnd() * WINDOW_MS);
  const dur = 300 + Math.floor(rnd() * 4000);
  const attrs = esc({ gateway: 'default/default', listener: 'llm', route: 'internal/llm:request' });
  rows.push(
    `('seed-${String(i).padStart(5, '0')}','${iso(startMs)}','${iso(startMs + dur)}',${dur},200,` +
      `'chat','${md.p}','${md.m}','${md.m}',${inTok},${outTok},${inTok + outTok},${cost.toFixed(8)},` +
      `'${pick(USERS)}','${pick(GROUPS)}','${pick(AGENTS)}',0,'${attrs}')`,
  );
}

// The gateway creates these tables idempotently on open; we create them here so the DB is
// already populated before the gateway starts. Schema mirrors the shipped request-log store.
const sql = `
CREATE TABLE IF NOT EXISTS request_logs (
  id TEXT PRIMARY KEY, started_at TEXT NOT NULL, completed_at TEXT NOT NULL,
  duration_ms INTEGER NOT NULL, trace_id TEXT, span_id TEXT, http_status INTEGER, error TEXT,
  gen_ai_operation_name TEXT, gen_ai_provider_name TEXT, gen_ai_request_model TEXT,
  gen_ai_response_model TEXT, input_tokens INTEGER, output_tokens INTEGER, total_tokens INTEGER,
  cost REAL, agentgateway_user TEXT, agentgateway_group TEXT, user_agent_name TEXT,
  has_payload INTEGER NOT NULL,
  attributes_json TEXT NOT NULL CHECK (json_valid(attributes_json))
);
CREATE TABLE IF NOT EXISTS request_log_payloads (
  log_id TEXT PRIMARY KEY REFERENCES request_logs(id) ON DELETE CASCADE,
  request_prompt_json TEXT CHECK (request_prompt_json IS NULL OR json_valid(request_prompt_json)),
  response_completion_json TEXT CHECK (response_completion_json IS NULL OR json_valid(response_completion_json))
);
CREATE INDEX IF NOT EXISTS idx_request_logs_completed_at ON request_logs(completed_at DESC, id DESC);
CREATE INDEX IF NOT EXISTS idx_request_logs_gen_ai_completed_at ON request_logs(gen_ai_provider_name, gen_ai_request_model, completed_at DESC);
CREATE INDEX IF NOT EXISTS idx_request_logs_user_completed_at ON request_logs(agentgateway_user, completed_at DESC, id DESC);
DELETE FROM request_logs;
INSERT INTO request_logs (id,started_at,completed_at,duration_ms,http_status,gen_ai_operation_name,gen_ai_provider_name,gen_ai_request_model,gen_ai_response_model,input_tokens,output_tokens,total_tokens,cost,agentgateway_user,agentgateway_group,user_agent_name,has_payload,attributes_json) VALUES
${rows.join(',\n')};
`;

const dbPath = process.argv[2];
if (!dbPath) {
  process.stdout.write(sql);
} else {
  const tmp = `${dbPath}.seed.sql`;
  writeFileSync(tmp, sql);
  execFileSync('sqlite3', [dbPath, `.read ${tmp}`], { stdio: 'inherit' });
  const count = execFileSync('sqlite3', [dbPath, 'SELECT count(*) FROM request_logs;']).toString().trim();
  process.stderr.write(`seeded ${count} rows into ${dbPath}\n`);
}
