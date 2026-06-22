// Minimal mock of the Swagger Petstore data API for the OpenAPI -> MCP capture.
// The real guide runs the swaggerapi/petstore3 (Java/Jetty) container, but that image is
// amd64-only and unusably slow under qemu on arm64. The OpenAPI *schema* is supplied to the
// gateway as a file (fixtures/petstore-openapi.json — the real spec, so the tool list is
// authentic); this server only needs to answer the upstream calls a tool makes. It returns
// a FIXED pet so the success screenshot is deterministic.
//
//   PORT=8080 node scripts/mock-petstore.mjs
//
// Path-tolerant: matches the `/pet/{id}` suffix regardless of the spec's server base
// (`/api/v3` vs `/`), so it works whichever prefix agentgateway prepends.
import { createServer } from 'node:http';

const PORT = Number(process.env.PORT || 8080);

const PET = {
  id: 1,
  name: 'doggie',
  category: { id: 1, name: 'Dogs' },
  photoUrls: ['https://example.com/photo1.jpg'],
  tags: [{ id: 101, name: 'fluffy' }],
  status: 'available',
};

function json(res, code, body) {
  res.writeHead(code, { 'content-type': 'application/json' });
  res.end(JSON.stringify(body));
}

createServer((req, res) => {
  const url = (req.url || '').split('?')[0];

  // getPetById — GET .../pet/{petId}
  const byId = url.match(/\/pet\/(\d+)$/);
  if (req.method === 'GET' && byId) {
    return json(res, 200, { ...PET, id: Number(byId[1]) });
  }
  // getInventory — GET .../store/inventory (no parameters; used for the success capture)
  if (req.method === 'GET' && url.endsWith('/store/inventory')) {
    return json(res, 200, { available: 7, pending: 2, sold: 3 });
  }
  // findPetsByStatus — GET .../pet/findByStatus
  if (req.method === 'GET' && url.endsWith('/pet/findByStatus')) {
    return json(res, 200, [PET]);
  }
  // addPet / updatePet — echo the body back
  if ((req.method === 'POST' || req.method === 'PUT') && url.endsWith('/pet')) {
    let body = '';
    req.on('data', (c) => (body += c));
    return req.on('end', () => {
      try {
        return json(res, 200, JSON.parse(body || '{}'));
      } catch {
        return json(res, 200, PET);
      }
    });
  }
  // Any other operation: a benign 200 so tool calls don't error in the capture.
  return json(res, 200, PET);
}).listen(PORT, () => console.log(`mock-petstore listening on :${PORT}`));
