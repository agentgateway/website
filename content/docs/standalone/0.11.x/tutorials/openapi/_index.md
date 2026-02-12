---
title: OpenAPI to MCP
weight: 5
description: Expose REST APIs as MCP tools using OpenAPI specifications
---

Convert REST APIs into MCP tools using OpenAPI specifications. This allows LLMs to interact with your existing APIs without writing custom MCP servers.

## What you'll build

In this tutorial, you'll:
1. Create a simple Pet Store API specification (OpenAPI format)
2. Set up a mock API server to handle requests
3. Configure Agent Gateway to expose the API as MCP tools
4. Test the generated tools using curl commands

## Prerequisites

- [Node.js](https://nodejs.org/) installed (for the mock API server)

## Step 1: Install Agent Gateway

Download and install Agent Gateway:

```bash
curl -sL https://agentgateway.dev/install | bash
```

## Step 2: Create an OpenAPI specification

First, create a new directory for this tutorial and navigate to it:

```bash
mkdir openapi-tutorial && cd openapi-tutorial
```

Now create a file called `openapi.json`. This file describes your REST API in OpenAPI format:

```bash
cat > openapi.json << 'EOF'
{
  "openapi": "3.0.0",
  "info": {
    "title": "Pet Store API",
    "version": "1.0.0"
  },
  "servers": [
    {
      "url": "/"
    }
  ],
  "paths": {
    "/pets": {
      "get": {
        "operationId": "listPets",
        "summary": "List all pets",
        "responses": {
          "200": {
            "description": "A list of pets"
          }
        }
      },
      "post": {
        "operationId": "createPet",
        "summary": "Create a new pet",
        "requestBody": {
          "content": {
            "application/json": {
              "schema": {
                "type": "object",
                "properties": {
                  "name": { "type": "string" },
                  "species": { "type": "string" }
                }
              }
            }
          }
        },
        "responses": {
          "201": {
            "description": "Pet created"
          }
        }
      }
    },
    "/pets/{id}": {
      "get": {
        "operationId": "getPet",
        "summary": "Get a pet by ID",
        "parameters": [
          {
            "name": "id",
            "in": "path",
            "required": true,
            "schema": { "type": "string" }
          }
        ],
        "responses": {
          "200": {
            "description": "A pet"
          }
        }
      }
    }
  }
}
EOF
```

This OpenAPI spec defines a simple Pet Store API with three endpoints:
- `GET /pets` - List all pets
- `POST /pets` - Create a new pet
- `GET /pets/{id}` - Get a specific pet by ID

## Step 3: Create the Agent Gateway config

Create a configuration file that tells Agent Gateway to expose your OpenAPI spec as MCP tools:

```bash
cat > config.yaml << 'EOF'
binds:
- port: 3000
  listeners:
  - routes:
    - policies:
        cors:
          allowOrigins: ["*"]
          allowHeaders: ["*"]
          exposeHeaders: ["Mcp-Session-Id"]
      backends:
      - mcp:
          targets:
          - name: petstore
            openapi:
              schema:
                file: ./openapi.json
              host: localhost:8080
EOF
```

This config:
- Listens on port 3000 for MCP connections
- Loads the OpenAPI spec from `openapi.json`
- Forwards API requests to `localhost:8080` (where our mock server will run)

## Step 4: Create a mock API server

For this tutorial, we'll create a simple Node.js server that simulates the Pet Store API. Create a file called `server.js`:

```bash
cat > server.js << 'EOF'
const http = require('http');

const pets = [
  { id: "1", name: "Buddy", species: "dog" },
  { id: "2", name: "Whiskers", species: "cat" }
];

const server = http.createServer((req, res) => {
  res.setHeader('Content-Type', 'application/json');

  if (req.method === 'GET' && req.url === '/pets') {
    res.end(JSON.stringify(pets));
  } else if (req.method === 'GET' && req.url.startsWith('/pets/')) {
    const id = req.url.split('/')[2];
    const pet = pets.find(p => p.id === id);
    if (pet) {
      res.end(JSON.stringify(pet));
    } else {
      res.statusCode = 404;
      res.end(JSON.stringify({ error: "Pet not found" }));
    }
  } else if (req.method === 'POST' && req.url === '/pets') {
    let body = '';
    req.on('data', chunk => body += chunk);
    req.on('end', () => {
      const newPet = JSON.parse(body);
      newPet.id = String(pets.length + 1);
      pets.push(newPet);
      res.statusCode = 201;
      res.end(JSON.stringify(newPet));
    });
  } else {
    res.statusCode = 404;
    res.end(JSON.stringify({ error: "Not found" }));
  }
});

server.listen(8080, () => console.log('Mock API running on http://localhost:8080'));
EOF
```

Now start the mock server:

```bash
node server.js
```

You should see:

```
Mock API running on http://localhost:8080
```

Keep this terminal running. The mock server needs to stay active for the tutorial.

## Step 5: Start Agent Gateway

Open a **new terminal window** and navigate to your tutorial directory:

```bash
cd openapi-tutorial
```

Start Agent Gateway:

```bash
agentgateway -f config.yaml
```

You should see output similar to:

```
INFO agentgateway: Listening on 0.0.0.0:3000
INFO agentgateway: Admin UI available at http://localhost:15000/ui/
```

Keep this terminal running as well. You now have two terminals:
1. Terminal 1: Running the mock API server (port 8080)
2. Terminal 2: Running Agent Gateway (port 3000)

## Step 6: Test the generated tools

Open a **third terminal** to run the test commands.

### Initialize an MCP session

MCP requires a session to be initialized first. Run this command:

```bash
curl -s -i http://localhost:3000/mcp \
  -H "Content-Type: application/json" \
  -H "Accept: application/json, text/event-stream" \
  -d '{"jsonrpc":"2.0","method":"initialize","params":{"protocolVersion":"2024-11-05","capabilities":{},"clientInfo":{"name":"test","version":"1.0"}},"id":1}'
```

Look for the `mcp-session-id` header in the response. It will look something like:

```
mcp-session-id: abc123-def456-ghi789
```

Copy this session ID value - you'll need it for the next commands.

### List available tools

Replace `YOUR_SESSION_ID` with the session ID you copied, then run:

```bash
curl -s http://localhost:3000/mcp \
  -H "Content-Type: application/json" \
  -H "Accept: application/json, text/event-stream" \
  -H "Mcp-Session-Id: YOUR_SESSION_ID" \
  -d '{"jsonrpc":"2.0","method":"tools/list","id":2}'
```

You should see three tools that were automatically generated from your OpenAPI spec:

```
"listPets"
"createPet"
"getPet"
```

## Step 7: Call a tool

Now let's call the `listPets` tool to verify everything works end-to-end. Replace `YOUR_SESSION_ID` with your session ID:

```bash
curl -s http://localhost:3000/mcp \
  -H "Content-Type: application/json" \
  -H "Accept: application/json, text/event-stream" \
  -H "Mcp-Session-Id: YOUR_SESSION_ID" \
  -d '{"jsonrpc":"2.0","method":"tools/call","params":{"name":"listPets","arguments":{}},"id":3}'
```

You should see the mock pets returned from your API server:

```json
[{"id":"1","name":"Buddy","species":"dog"},{"id":"2","name":"Whiskers","species":"cat"}]
```

Congratulations! You've successfully exposed a REST API as MCP tools using Agent Gateway.

## Cleanup

When you're done, stop the running processes:
- Press `Ctrl+C` in the terminal running Agent Gateway
- Press `Ctrl+C` in the terminal running the mock server

---

## How it works

Agent Gateway automatically:
- **Parses the OpenAPI spec** - Reads your API definition and understands the available endpoints
- **Generates MCP tools** - Each API operation (like `GET /pets`) becomes a callable MCP tool
- **Handles requests** - When a tool is called, Agent Gateway translates it to an HTTP request
- **Returns responses** - API responses are converted back to MCP format for the client

## Tool naming

Tools are named using the `operationId` field from your OpenAPI spec:

| OpenAPI operationId | MCP Tool Name |
|---------------------|---------------|
| `listPets` | `listPets` |
| `createPet` | `createPet` |
| `getPet` | `getPet` |

## Using with real APIs

In production, you would point Agent Gateway to your actual API server instead of the mock server. Simply update the `host` field in the config:

```yaml
targets:
- name: petstore
  openapi:
    schema:
      file: ./openapi.json
    host: api.yourcompany.com:443
```

## Remote OpenAPI specs

You can also load OpenAPI specs directly from a URL instead of a local file:

```yaml
targets:
- name: api
  openapi:
    schema:
      url: https://api.example.com/openapi.json
    host: api.example.com
```

## Next steps

{{< cards >}}
  {{< card link="/docs/mcp/connect/openapi" title="OpenAPI Transform" subtitle="Advanced OpenAPI options" >}}
  {{< card link="/docs/mcp/" title="MCP Overview" subtitle="Understanding MCP connectivity" >}}
{{< /cards >}}
