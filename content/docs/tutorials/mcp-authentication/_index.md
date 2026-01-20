---
title: MCP Authentication
weight: 8
description: Implement OAuth-based authentication for MCP connections using the MCP auth spec
---

Agent Gateway supports the [MCP Authorization specification](https://modelcontextprotocol.io/specification/draft/basic/authorization), enabling OAuth-based authentication for MCP endpoints. This tutorial shows you how to secure MCP tools with token-based access.

## What you'll build

In this tutorial, you'll:
1. Configure MCP authentication with JWT token validation
2. Expose OAuth protected resource metadata
3. Test authenticated and unauthenticated requests
4. Understand the MCP authentication flow

## Prerequisites

- [Node.js](https://nodejs.org/) installed (for the MCP server)

## Step 1: Install Agent Gateway

```bash
curl -sL https://raw.githubusercontent.com/agentgateway/agentgateway/refs/heads/main/common/scripts/get-agentgateway | bash
```

## Step 2: Download test keys

Create a directory for this tutorial:

```bash
mkdir mcp-auth-tutorial && cd mcp-auth-tutorial
```

Download the pre-generated test keys from the Agent Gateway repository:

```bash
# Download the JWKS public key
curl -sL https://raw.githubusercontent.com/agentgateway/agentgateway/main/manifests/jwt/pub-key -o pub-key

# Download a pre-generated test JWT token
curl -sL https://raw.githubusercontent.com/agentgateway/agentgateway/main/manifests/jwt/example1.key -o test-token.jwt
```

{{< callout type="warning" >}}
These are **test keys only**. For production, use keys from your OAuth provider (Keycloak, Auth0, etc.).
{{< /callout >}}

## Step 3: Create the config

Create a configuration file with MCP authentication enabled:

```bash
cat > config.yaml << 'EOF'
binds:
- port: 3000
  listeners:
  - routes:
    - backends:
      - mcp:
          targets:
          - name: everything
            stdio:
              cmd: npx
              args: ["@modelcontextprotocol/server-everything"]
      matches:
      - path:
          exact: /mcp
      - path:
          exact: /.well-known/oauth-protected-resource/mcp
      policies:
        cors:
          allowOrigins: ["*"]
          allowHeaders: ["*"]
          exposeHeaders: ["Mcp-Session-Id"]
        mcpAuthentication:
          mode: strict
          issuer: agentgateway.dev
          audiences: [test.agentgateway.dev]
          jwks:
            file: ./pub-key
          resourceMetadata:
            resource: http://localhost:3000/mcp
            scopesSupported:
            - read:all
            bearerMethodsSupported:
            - header
EOF
```

Key configuration:
- `mode: strict` - Requires valid JWT for all requests (options: `strict`, `optional`, `permissive`)
- `issuer` - Expected JWT issuer claim
- `audiences` - Expected JWT audience claim
- `jwks.file` - Path to public key for token validation
- `resourceMetadata` - OAuth protected resource metadata for MCP clients

## Step 4: Start Agent Gateway

```bash
agentgateway -f config.yaml
```

You should see:
```
INFO agentgateway: Listening on 0.0.0.0:3000
INFO agentgateway: Admin UI available at http://localhost:15000/ui/
```

## Step 5: Test without authentication

Try to access the MCP endpoint without a token:

```bash
curl -s -i http://localhost:3000/mcp \
  -H "Content-Type: application/json" \
  -H "Accept: application/json, text/event-stream" \
  -d '{"jsonrpc":"2.0","method":"initialize","params":{"protocolVersion":"2024-11-05","capabilities":{},"clientInfo":{"name":"test","version":"1.0"}},"id":1}'
```

You should get a `401 Unauthorized` response:

```
HTTP/1.1 401 Unauthorized
www-authenticate: Bearer resource_metadata="http://localhost:3000/.well-known/oauth-protected-resource/mcp"
content-type: application/json

{"error":"unauthorized","error_description":"JWT token required"}
```

Notice the `www-authenticate` header points to the protected resource metadata endpoint.

## Step 6: Check the protected resource metadata

MCP clients can discover authentication requirements from the metadata endpoint:

```bash
curl -s http://localhost:3000/.well-known/oauth-protected-resource/mcp | jq .
```

Response:
```json
{
  "resource": "http://localhost:3000/mcp",
  "authorization_servers": ["agentgateway.dev"],
  "mcp_protocol_version": "2025-06-18",
  "resource_type": "mcp-server",
  "bearer_methods_supported": ["header"],
  "scopes_supported": ["read:all"]
}
```

This tells clients:
- Which authorization servers to use
- What scopes are required
- How to send the bearer token (header, body, or query)

## Step 7: Test with a valid token

Now test with the pre-generated JWT token:

```bash
curl -s -i http://localhost:3000/mcp \
  -H "Content-Type: application/json" \
  -H "Accept: application/json, text/event-stream" \
  -H "Authorization: Bearer $(cat test-token.jwt)" \
  -d '{"jsonrpc":"2.0","method":"initialize","params":{"protocolVersion":"2024-11-05","capabilities":{},"clientInfo":{"name":"test","version":"1.0"}},"id":1}'
```

You should see a successful `200 OK` response with the MCP session initialized.

---

## Authentication Modes

| Mode | Behavior |
|------|----------|
| `strict` | Requires valid JWT for all requests. Returns 401 if missing or invalid. |
| `optional` | Validates JWT if present, but allows unauthenticated requests. |
| `permissive` | Attempts validation but doesn't enforce it. Useful for debugging. |

## MCP Authentication Flow

When an MCP client connects to a protected resource:

1. **Client requests resource** - Sends initialize request to `/mcp`
2. **Gateway returns 401** - Includes `www-authenticate` header with metadata URL
3. **Client fetches metadata** - Gets `/.well-known/oauth-protected-resource/mcp`
4. **Client authenticates** - Obtains token from authorization server
5. **Client retries with token** - Includes `Authorization: Bearer <token>` header

---

## Keycloak Integration

For production with Keycloak:

```yaml
binds:
- port: 3000
  listeners:
  - routes:
    - backends:
      - mcp:
          targets:
          - name: tools
            stdio:
              cmd: npx
              args: ["@modelcontextprotocol/server-everything"]
      matches:
      - path:
          exact: /mcp
      - path:
          exact: /.well-known/oauth-protected-resource/mcp
      - path:
          exact: /.well-known/oauth-authorization-server/mcp
      - path:
          exact: /.well-known/oauth-authorization-server/mcp/client-registration
      policies:
        cors:
          allowOrigins: ["*"]
          allowHeaders: ["*"]
          exposeHeaders: ["Mcp-Session-Id"]
        mcpAuthentication:
          mode: strict
          issuer: http://localhost:7080/realms/mcp
          audiences: [mcp_proxy]
          jwks:
            url: http://localhost:7080/realms/mcp/protocol/openid-connect/certs
          provider:
            keycloak: {}
          resourceMetadata:
            resource: http://localhost:3000/mcp
            scopesSupported:
            - profile
            - offline_access
            - openid
            bearerMethodsSupported:
            - header
```

The `provider.keycloak` setting enables special handling for Keycloak's non-standard OAuth endpoints.

## Auth0 Integration

For production with Auth0:

```yaml
mcpAuthentication:
  mode: strict
  issuer: https://your-tenant.auth0.com/
  audiences: [your-api-identifier]
  jwks:
    url: https://your-tenant.auth0.com/.well-known/jwks.json
  provider:
    auth0: {}
  resourceMetadata:
    resource: http://localhost:3000/mcp
    scopesSupported:
    - openid
    - profile
    bearerMethodsSupported:
    - header
```

## Cleanup

Stop Agent Gateway with `Ctrl+C`, then remove the tutorial directory:

```bash
cd .. && rm -rf mcp-auth-tutorial
```

## Next steps

{{< cards >}}
  {{< card link="/docs/mcp/mcp-authn" title="MCP Authentication Reference" subtitle="Complete MCP auth guide" >}}
  {{< card link="/docs/tutorials/authorization" title="JWT Authorization" subtitle="Fine-grained tool access control" >}}
  {{< card link="/docs/configuration/security/" title="Security Configuration" subtitle="All security options" >}}
{{< /cards >}}
