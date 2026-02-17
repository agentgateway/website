---
title: HTTP Routing & Policies
weight: 12
description: Configure advanced HTTP routing with matching, policies, and traffic management
---

Agentgateway provides powerful HTTP routing capabilities including path matching, header-based routing, rate limiting, retries, and request/response modification.

## What you'll build

In this tutorial, you configure the following.

1. Configure HTTP routing with path, header, and query matching
2. Create health check endpoints with direct responses
3. Set up CORS, rate limiting, retries, and timeouts
4. Implement IP-based authorization
5. Modify requests and responses with header transformations

## Before you begin

- [agentgateway installed]({{< link-hextra path="/quickstart/" >}})

## Step 1: Create a working directory

```bash
mkdir http-routing-test && cd http-routing-test
```

## Step 2: Create a basic routing configuration

Create a `config.yaml` file with multiple routing examples.

```bash
cat > config.yaml << 'EOF'
# yaml-language-server: $schema=https://agentgateway.dev/schema/config
binds:
- port: 3000
  listeners:
  - protocol: HTTP
    routes:
    # Health check - direct response without backend
    - name: health-check
      matches:
      - path:
          pathPrefix: /health
      policies:
        directResponse:
          body: '{"status": "healthy"}'
          status: 200

    # API route with path, query, and header matching
    - name: api-v2
      matches:
      - path:
          pathPrefix: /api
        method: GET
        query:
        - name: version
          value:
            exact: v2
        headers:
        - name: x-api-key
          value:
            regex: "key-[a-z0-9]+"
      policies:
        directResponse:
          body: '{"message": "API v2 matched!"}'
          status: 200

    # Route with CORS and rate limiting
    - name: protected-api
      matches:
      - path:
          pathPrefix: /protected
      policies:
        cors:
          allowHeaders: ["content-type", "authorization"]
          allowOrigins: ["https://example.com"]
          allowCredentials: true
          allowMethods: ["GET", "POST"]
          maxAge: 3600s
        localRateLimit:
        - maxTokens: 10
          tokensPerFill: 1
          fillInterval: 1s
        directResponse:
          body: '{"message": "Protected endpoint"}'
          status: 200

    # IP-based authorization
    - name: internal-only
      matches:
      - path:
          pathPrefix: /internal
      policies:
        authorization:
          rules:
          - |
            cidr("127.0.0.0/8").containsIP(source.address)
        directResponse:
          body: '{"message": "Internal access granted"}'
          status: 200

    # Catch-all route
    - name: default
      policies:
        directResponse:
          body: '{"error": "Not found"}'
          status: 404
EOF
```

## Step 3: Start agentgateway

```bash
agentgateway -f config.yaml
```

## Step 4: Test the routes

### Test health check endpoint

```bash
curl http://localhost:3000/health
```

**Expected response:**
```json
{"status": "healthy"}
```

### Test path + query + header matching

The API v2 route requires all conditions to match.

```bash
# Missing query param and header - falls through to 404
curl http://localhost:3000/api
```
```json
{"error": "Not found"}
```

```bash
# All conditions met - matches API v2
curl "http://localhost:3000/api?version=v2" -H "x-api-key: key-abc123"
```
```json
{"message": "API v2 matched!"}
```

### Test CORS preflight

```bash
curl -X OPTIONS http://localhost:3000/protected \
  -H "Origin: https://example.com" \
  -H "Access-Control-Request-Method: GET" \
  -i
```

**Expected headers:**
```
access-control-allow-origin: https://example.com
access-control-allow-methods: GET,POST
access-control-allow-headers: content-type,authorization
access-control-max-age: 3600
```

### Test rate limiting

```bash
# Send 15 rapid requests
for i in $(seq 1 15); do
  code=$(curl -s -o /dev/null -w "%{http_code}" http://localhost:3000/protected)
  echo "Request $i: $code"
done
```

After exceeding the rate limit (10 tokens), you'll see `429 Too Many Requests`.

### Test IP-based authorization

```bash
# From localhost (IPv4) - should be allowed
curl http://127.0.0.1:3000/internal
```
```json
{"message": "Internal access granted"}
```

## Matching rules reference

### Path matching

```yaml
matches:
- path:
    pathPrefix: /api     # Matches /api, /api/users, /api/v1/...
- path:
    exact: /health       # Matches only /health
- path:
    regex: "/users/[0-9]+"  # Regex pattern
```

### Header matching

```yaml
matches:
- headers:
  - name: x-api-version
    value:
      exact: "2.0"
  - name: authorization
    value:
      regex: "Bearer .+"
```

### Query parameter matching

```yaml
matches:
- query:
  - name: format
    value:
      exact: json
```

### Method matching

```yaml
matches:
- method: GET    # Only match GET requests
- method: POST   # Only match POST requests
```

## Traffic policies reference

### Rate limiting

```yaml
policies:
  localRateLimit:
  - maxTokens: 100      # Maximum burst size
    tokensPerFill: 10   # Tokens added per interval
    fillInterval: 1s    # Refill interval
```

### Retries

```yaml
policies:
  retry:
    attempts: 3
    codes: [502, 503, 504, 429]
    backoff:
      baseInterval: 100ms
      maxInterval: 1s
```

### Timeouts

```yaml
policies:
  timeout:
    requestTimeout: 30s
    idleTimeout: 60s
```

### CORS

```yaml
policies:
  cors:
    allowOrigins: ["https://example.com", "https://app.example.com"]
    allowMethods: ["GET", "POST", "PUT", "DELETE"]
    allowHeaders: ["content-type", "authorization"]
    exposeHeaders: ["x-request-id"]
    allowCredentials: true
    maxAge: 3600s
```

### Request/Response header modification

```yaml
policies:
  requestHeaderModifier:
    add:
      x-request-id: '${uuid()}'
    set:
      x-forwarded-for: '${source.address}'
    remove:
    - x-internal-header
  responseHeaderModifier:
    set:
      x-served-by: agentgateway
```

### URL rewriting

```yaml
policies:
  urlRewrite:
    path:
      full: "/new-path"
    authority:
      full: "backend.internal"
```

### Request mirroring

```yaml
policies:
  requestMirror:
    backend:
      host: 127.0.0.1:8081
    percentage: 0.1  # Mirror 10% of traffic
```

### Direct response

```yaml
policies:
  directResponse:
    body: '{"status": "ok"}'
    status: 200
```

### IP-based authorization

```yaml
policies:
  authorization:
    rules:
    # Allow specific CIDR ranges
    - |
      cidr("10.0.0.0/8").containsIP(source.address)
    # Or combine with OR logic
    - |
      cidr("192.168.0.0/16").containsIP(source.address) ||
      cidr("172.16.0.0/12").containsIP(source.address)
```

## Routing with backends

When routing to actual backend services, use the following configuration.

```yaml
routes:
- name: api-backend
  matches:
  - path:
      pathPrefix: /api
  policies:
    retry:
      attempts: 3
      codes: [502, 503, 504]
    timeout:
      requestTimeout: 30s
  backends:
  - host: api.internal:8080

- name: mcp-backend
  matches:
  - path:
      pathPrefix: /mcp
  policies:
    cors:
      allowOrigins: ["*"]
      allowHeaders: ["*"]
      exposeHeaders: ["Mcp-Session-Id"]
  backends:
  - mcp:
      targets:
      - name: everything
        stdio:
          cmd: npx
          args: ["@modelcontextprotocol/server-everything"]
```

## Cleanup

Stop the agentgateway with `Ctrl+C` and remove the test directory.

```bash
cd .. && rm -rf http-routing-test
```

## Learn more

{{< cards >}}
  {{< card link="/docs/configuration/routes" title="Routes Configuration" subtitle="Complete routing options" >}}
  {{< card link="/docs/configuration/resiliency/" title="Resiliency" subtitle="Rate limits, retries, and timeouts" >}}
  {{< card link="/docs/configuration/traffic-management/" title="Traffic Management" subtitle="Headers, rewrites, and mirroring" >}}
{{< /cards >}}
