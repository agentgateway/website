// Minimal MCP "time" server over the streamable-HTTP transport, for the multiplex
// (virtual MCP) capture. The real guide uses `uvx mcp-server-time` over stdio, but the
// distroless sl8 image can't exec stdio targets, so the gateway multiplexes it as an
// HTTP target (mcp.host) instead. This mock exposes the same two tools — get_current_time
// and convert_time — and returns FIXED output so the screenshot baseline never drifts.
//
//   PORT=3006 node scripts/mock-mcp-time.mjs
//
// agentgateway is the MCP *client* here; it POSTs JSON-RPC (initialize ->
// notifications/initialized -> tools/list -> tools/call) to /mcp. We always answer with a
// single application/json JSON-RPC response (allowed by the streamable-HTTP spec when the
// server does not stream) and echo an Mcp-Session-Id header.
//
// NOTE: verify on the first dockerized capture run. If agentgateway rejects this hand-rolled
// transport, the fallback is to bridge the real server with `uvx mcp-proxy` (see README).
import { createServer } from 'node:http';

const PORT = Number(process.env.PORT || 3006);
const SESSION_ID = 'mock-time-session';
// Fixed so get_current_time is deterministic for pixel baselines.
const FIXED = { America: '2026-06-22T10:00:00-04:00', timezone: 'America/New_York' };

const TOOLS = [
  {
    name: 'get_current_time',
    description: 'Get current time in a specific timezone',
    inputSchema: {
      type: 'object',
      properties: { timezone: { type: 'string', description: 'IANA timezone name, e.g. America/New_York' } },
      required: ['timezone'],
    },
  },
  {
    name: 'convert_time',
    description: 'Convert time between timezones',
    inputSchema: {
      type: 'object',
      properties: {
        source_timezone: { type: 'string' },
        time: { type: 'string', description: '24-hour time, e.g. 14:30' },
        target_timezone: { type: 'string' },
      },
      required: ['source_timezone', 'time', 'target_timezone'],
    },
  },
];

function textResult(obj) {
  return { content: [{ type: 'text', text: JSON.stringify(obj, null, 2) }] };
}

function handle(message) {
  const { id, method, params } = message;
  switch (method) {
    case 'initialize':
      return {
        jsonrpc: '2.0',
        id,
        result: {
          protocolVersion: params?.protocolVersion ?? '2025-03-26',
          capabilities: { tools: {} },
          serverInfo: { name: 'mock-time', version: '0.1.0' },
        },
      };
    case 'tools/list':
      return { jsonrpc: '2.0', id, result: { tools: TOOLS } };
    case 'tools/call': {
      const name = params?.name;
      const args = params?.arguments ?? {};
      if (name === 'get_current_time') {
        return {
          jsonrpc: '2.0',
          id,
          result: textResult({ timezone: args.timezone || FIXED.timezone, datetime: FIXED.America, is_dst: true }),
        };
      }
      if (name === 'convert_time') {
        return {
          jsonrpc: '2.0',
          id,
          result: textResult({
            source: { timezone: args.source_timezone, datetime: FIXED.America },
            target: { timezone: args.target_timezone, datetime: FIXED.America },
          }),
        };
      }
      return { jsonrpc: '2.0', id, error: { code: -32601, message: `Unknown tool: ${name}` } };
    }
    default:
      // Notifications (no id) — e.g. notifications/initialized — get no response body.
      if (id === undefined) return null;
      return { jsonrpc: '2.0', id, error: { code: -32601, message: `Unknown method: ${method}` } };
  }
}

createServer((req, res) => {
  const cors = {
    'access-control-allow-origin': '*',
    'access-control-allow-headers': '*',
    'access-control-expose-headers': 'Mcp-Session-Id',
    'access-control-allow-methods': 'GET,POST,OPTIONS',
  };
  if (req.method === 'OPTIONS') {
    res.writeHead(204, cors);
    return res.end();
  }
  // This server never pushes server->client messages, so it offers no SSE stream.
  if (req.method === 'GET') {
    res.writeHead(405, cors);
    return res.end();
  }
  let body = '';
  req.on('data', (c) => (body += c));
  req.on('end', () => {
    let message;
    try {
      message = JSON.parse(body || '{}');
    } catch {
      res.writeHead(400, cors);
      return res.end();
    }
    const response = handle(message);
    if (response === null) {
      res.writeHead(202, { 'mcp-session-id': SESSION_ID, ...cors });
      return res.end();
    }
    res.writeHead(200, { 'content-type': 'application/json', 'mcp-session-id': SESSION_ID, ...cors });
    res.end(JSON.stringify(response));
  });
}).listen(PORT, () => console.log(`mock-mcp-time listening on :${PORT}/mcp`));
