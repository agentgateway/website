#!/usr/bin/env node
// Deterministic seeder for the cost-dashboard capture (llm/cost-controls/dashboard.md).
//
// Writes a populated `request_logs` SQLite database so the Admin UI Costs/Analytics pages
// render a rich, blog-style dashboard without sending live traffic. The row MAGNITUDES are
// deterministic (a fixed-seed LCG, no Math.random), so per-group cost/token breakdowns are
// identical every run; only the absolute timestamps track "now" so the rows always land in
// the dashboard's default 24h window.
//
// A handful of the newest rows are CONVERSATION rows: they carry a request_log_payloads entry
// with a full agent-loop transcript (system + user prompt, an assistant tool call, the tool
// result, and the final answer), so the LLM > Logs detail view renders its Trajectory and
// Conversation sections (observability/access-logs/view.md). They replace generated rows rather
// than adding to the total, so the analytics captures still see exactly SEED_ROWS calls.
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
// Generated rows stay at least this far in the past, so the conversation rows below (which sit
// in the last few minutes) are always the newest and always head the LLM > Logs list. Without
// the gap a generated row can land on top and the list capture reorders run to run.
const GENERIC_MIN_AGE_MS = 30 * 60 * 1000;
const iso = (ms) => new Date(ms).toISOString().replace('Z', '+00:00');
const esc = (o) => JSON.stringify(o).replace(/'/g, "''");

// Deterministic agent-loop transcripts for the Logs detail capture. Each entry is the FINAL
// turn of a loop, so its prompt carries the whole history — system, user, the assistant's tool
// call, and the tool result — and its completion carries the answer. That shape is what makes
// the Trajectory render all four of its lanes (input, model, tool call, tool result); a
// first-turn row would only ever show two.
const CONVERSATIONS = [
  {
    id: 'chat-support-escalation',
    user: 'alice',
    group: 'research',
    agent: 'Claude Code',
    provider: 'openai',
    model: 'gpt-4o',
    inTok: 1204,
    outTok: 318,
    durationMs: 1840,
    system: 'You are a release assistant for the platform team. Search the release notes before you answer, and cite the version you found.',
    question: 'Which agentgateway release introduced the model cost catalog, and what does it price?',
    tool: 'search_release_notes',
    toolArgs: { query: 'model cost catalog', limit: 3 },
    toolResult:
      '[{"version":"1.3.0","title":"Model cost catalog","body":"Adds config.modelCatalog, which prices each request from a JSON catalog of per-model input and output rates."}]',
    answer:
      'The model cost catalog landed in agentgateway 1.3.0. You point `config.modelCatalog` at one or more JSON files that give per-model input and output rates, and agentgateway prices every LLM request against them. The realized USD cost is then written to the request log and surfaced on the LLM > Analytics page.',
  },
  {
    id: 'chat-token-budget',
    user: 'bob',
    group: 'platform',
    agent: 'Cursor',
    provider: 'anthropic',
    model: 'claude-3-5-sonnet',
    inTok: 2870,
    outTok: 604,
    durationMs: 3120,
    system: 'You are a FinOps assistant. Use the usage tool for any question about spend.',
    question: 'How much did the research group spend on gpt-4o in the last day, and who drove most of it?',
    tool: 'query_usage',
    toolArgs: { group: 'research', model: 'gpt-4o', window: '24h' },
    toolResult:
      '{"group":"research","model":"gpt-4o","totalCostUsd":41.86,"calls":213,"topUser":{"user":"alice","costUsd":22.4}}',
    answer:
      'The research group spent $41.86 on gpt-4o across 213 calls in the last 24 hours. Alice accounts for $22.40 of that, just over half. If you want a hard ceiling rather than a report, attach a budget to her virtual API key.',
  },
  {
    id: 'chat-tool-discovery',
    user: 'carol',
    group: 'support',
    agent: 'codex',
    provider: 'openai',
    model: 'gpt-4o-mini',
    inTok: 942,
    outTok: 211,
    durationMs: 1290,
    system: 'You are a support engineer. Look up the customer record before answering.',
    question: 'Is the acme-corp gateway still on the 1.2 line?',
    tool: 'lookup_customer',
    toolArgs: { account: 'acme-corp' },
    toolResult: '{"account":"acme-corp","gatewayVersion":"1.2.1","supportTier":"gold","upgradeWindow":"2026-09-14"}',
    answer:
      'Yes, acme-corp is still on 1.2.1. They are a gold-tier account with an upgrade window booked for 14 September 2026, so the 1.2 line is expected to be retired for them then.',
  },
];

// Cost per row, from the model rates above.
function priceOf(provider, model, inTok, outTok) {
  const md = MODELS.find((m) => m.p === provider && m.m === model);
  return md ? (inTok / 1e6) * md.in + (outTok / 1e6) * md.out : 0;
}

const rows = [];
const payloadRows = [];
// Conversation rows replace generated ones so the analytics captures still see exactly N calls.
const GENERIC = Math.max(0, N - CONVERSATIONS.length);
for (let i = 0; i < GENERIC; i++) {
  const md = pick(MODELS);
  const inTok = 200 + Math.floor(rnd() * 4000);
  const outTok = 50 + Math.floor(rnd() * 1500);
  const cost = (inTok / 1e6) * md.in + (outTok / 1e6) * md.out;
  const startMs = NOW - GENERIC_MIN_AGE_MS - Math.floor(rnd() * (WINDOW_MS - GENERIC_MIN_AGE_MS));
  const dur = 300 + Math.floor(rnd() * 4000);
  const attrs = esc({ gateway: 'default/default', listener: 'llm', route: 'internal/llm:request' });
  rows.push(
    `('seed-${String(i).padStart(5, '0')}','${iso(startMs)}','${iso(startMs + dur)}',${dur},200,` +
      `'chat','${md.p}','${md.m}','${md.m}',${inTok},${outTok},${inTok + outTok},${cost.toFixed(8)},` +
      `'${pick(USERS)}','${pick(GROUPS)}','${pick(AGENTS)}',0,'${attrs}')`,
  );
}

// Conversation rows: newest first, so they sit at the top of the LLM > Logs list where the
// detail capture clicks. Each carries a request_log_payloads entry with the full transcript.
CONVERSATIONS.forEach((c, i) => {
  const startMs = NOW - (i + 1) * 45_000; // ~45s apart, all within the last few minutes
  const cost = priceOf(c.provider, c.model, c.inTok, c.outTok);
  const attrs = esc({ gateway: 'default/default', listener: 'llm', route: 'internal/llm:request' });
  rows.push(
    `('${c.id}','${iso(startMs)}','${iso(startMs + c.durationMs)}',${c.durationMs},200,` +
      `'chat','${c.provider}','${c.model}','${c.model}',${c.inTok},${c.outTok},${c.inTok + c.outTok},` +
      `${cost.toFixed(8)},'${c.user}','${c.group}','${c.agent}',1,'${attrs}')`,
  );

  // OpenAI-shaped payloads. The prompt is the whole loop history, which is what gives the
  // Trajectory its input / model / tool-call / tool-result lanes.
  const prompt = {
    messages: [
      { role: 'system', content: c.system },
      { role: 'user', content: c.question },
      {
        role: 'assistant',
        content: null,
        tool_calls: [
          {
            id: `call_${c.id}`,
            type: 'function',
            function: { name: c.tool, arguments: JSON.stringify(c.toolArgs) },
          },
        ],
      },
      { role: 'tool', name: c.tool, tool_call_id: `call_${c.id}`, content: c.toolResult },
    ],
  };
  const completion = {
    choices: [{ index: 0, finish_reason: 'stop', message: { role: 'assistant', content: c.answer } }],
  };
  payloadRows.push(`('${c.id}','${esc(prompt)}','${esc(completion)}')`);
});

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
DELETE FROM request_log_payloads;
DELETE FROM request_logs;
INSERT INTO request_logs (id,started_at,completed_at,duration_ms,http_status,gen_ai_operation_name,gen_ai_provider_name,gen_ai_request_model,gen_ai_response_model,input_tokens,output_tokens,total_tokens,cost,agentgateway_user,agentgateway_group,user_agent_name,has_payload,attributes_json) VALUES
${rows.join(',\n')};
INSERT INTO request_log_payloads (log_id,request_prompt_json,response_completion_json) VALUES
${payloadRows.join(',\n')};
`;

const dbPath = process.argv[2];
if (!dbPath) {
  process.stdout.write(sql);
} else {
  const tmp = `${dbPath}.seed.sql`;
  writeFileSync(tmp, sql);
  execFileSync('sqlite3', [dbPath, `.read ${tmp}`], { stdio: 'inherit' });
  const count = execFileSync('sqlite3', [dbPath, 'SELECT count(*) FROM request_logs;']).toString().trim();
  const payloads = execFileSync('sqlite3', [dbPath, 'SELECT count(*) FROM request_log_payloads;']).toString().trim();
  process.stderr.write(`seeded ${count} rows (${payloads} with conversation payloads) into ${dbPath}\n`);
}
