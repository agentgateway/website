// Minimal OpenAI-compatible mock server for deterministic LLM playground captures.
// Returns a fixed chat completion so screenshots never vary (no real key, no cost, CI-safe).
// agentgateway's `openAI` provider with `hostOverride` pointed here forwards requests to it.
//
//   PORT=8088 node scripts/mock-openai.mjs
import { createServer } from 'node:http';

const PORT = Number(process.env.PORT || 8088);
const REPLY = 'Hello! Agentgateway routed this request to the mock LLM provider.';
const MODEL = 'gpt-4o-mini';

function chatCompletion() {
  return {
    id: 'chatcmpl-mock-0001',
    object: 'chat.completion',
    created: 1700000000,
    model: MODEL,
    choices: [
      {
        index: 0,
        message: { role: 'assistant', content: REPLY },
        finish_reason: 'stop',
      },
    ],
    usage: { prompt_tokens: 12, completion_tokens: 16, total_tokens: 28 },
  };
}

// Stream the reply as OpenAI SSE chunks.
function streamChunks(res) {
  const send = (obj) => res.write(`data: ${JSON.stringify(obj)}\n\n`);
  const base = { id: 'chatcmpl-mock-0001', object: 'chat.completion.chunk', created: 1700000000, model: MODEL };
  send({ ...base, choices: [{ index: 0, delta: { role: 'assistant' }, finish_reason: null }] });
  for (const word of REPLY.split(' ')) {
    send({ ...base, choices: [{ index: 0, delta: { content: word + ' ' }, finish_reason: null }] });
  }
  send({ ...base, choices: [{ index: 0, delta: {}, finish_reason: 'stop' }] });
  res.write('data: [DONE]\n\n');
  res.end();
}

createServer((req, res) => {
  const cors = {
    'access-control-allow-origin': '*',
    'access-control-allow-headers': '*',
    'access-control-allow-methods': 'GET,POST,OPTIONS',
  };
  if (req.method === 'OPTIONS') {
    res.writeHead(204, cors);
    return res.end();
  }
  // Model list, in case the UI fetches it.
  if (req.method === 'GET' && req.url?.includes('/models')) {
    res.writeHead(200, { 'content-type': 'application/json', ...cors });
    return res.end(JSON.stringify({ object: 'list', data: [{ id: MODEL, object: 'model', owned_by: 'mock' }] }));
  }
  let body = '';
  req.on('data', (c) => (body += c));
  req.on('end', () => {
    let stream = false;
    try {
      stream = JSON.parse(body || '{}').stream === true;
    } catch {
      /* non-JSON body — treat as non-streaming */
    }
    if (stream) {
      res.writeHead(200, { 'content-type': 'text/event-stream', 'cache-control': 'no-cache', ...cors });
      return streamChunks(res);
    }
    res.writeHead(200, { 'content-type': 'application/json', ...cors });
    res.end(JSON.stringify(chatCompletion()));
  });
}).listen(PORT, () => console.log(`mock-openai listening on :${PORT}`));
