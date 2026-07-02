---
title: Descope
weight: 40
description: Integrate agentgateway with Descope for authentication and identity management
---

[Descope](https://www.descope.com/) is an authentication and user management platform. agentgateway can validate JWTs issued by Descope to protect your MCP servers.

## Why use Descope with agentgateway?

- **MCP-native OAuth 2.1 compliance** - [MCP Servers](https://docs.descope.com/agentic-identity-hub/core-components/mcp-servers) let you protect your MCP gateway with a full OAuth 2.1 compliant provider. [CIMD](https://docs.descope.com/agentic-identity-hub/core-components/mcp-servers/registration-methods#client-id-metadata-documents-cimd) and [DCR](https://docs.descope.com/agentic-identity-hub/core-components/mcp-servers/registration-methods#dynamic-client-registration-dcr) are both supported as registration methods.
- **Agent Directory** - View all of your [agentic identities](https://docs.descope.com/agentic-identity-hub/core-components/agents) within one centralized IAM platform.
- **Machine-to-machine access** - [Client credentials flow](https://docs.descope.com/agentic-identity-hub/core-components/clients#client-credentials) for agents and backends that need unattended access.
- **Policies** - Enforce [policy](https://docs.descope.com/identity-federation/policies) rules for agent access to downstream services, in conjunction with agentgateway authorization rules using JWT `roles` claims.
- **User consent for agents** - [Visual consent flows](https://docs.descope.com/flows) let users explicitly approve which MCP scopes and tools an agent can access.

## Configuration

Configure agentgateway to validate Descope JWTs.

```yaml
# yaml-language-server: $schema=https://agentgateway.dev/schema/config
mcp:
  port: 3000
  policies:
    cors:
      allowOrigins: ["*"]
      allowHeaders: ["*"]
      exposeHeaders: ["Mcp-Session-Id"]
    mcpAuthentication:
      mode: strict
      issuer: <YOUR_ISSUER_URL>
      audiences: [<YOUR_MCP_SERVER_URL>]
      jwks:
        url: https://api.descope.com/<YOUR_PROJECT_ID>/.well-known/jwks.json
      resourceMetadata:
        resource: <YOUR_MCP_SERVER_URL>
        scopesSupported:
          - read:all
        bearerMethodsSupported:
          - header
  targets:
    - name: everything
      stdio:
        cmd: npx
        args: ["@modelcontextprotocol/server-everything"]
```

- `<YOUR_ISSUER_URL>`: Copy this from the **Connection Information** section of your [MCP Server](https://docs.descope.com/agentic-identity-hub/core-components/mcp-servers) configuration in the Descope Console.
- `<YOUR_PROJECT_ID>`: Found in the Descope Console under **Project Settings**. The JWKS URL always uses the project ID.
- `<YOUR_MCP_SERVER_URL>`: Your MCP server's public URL, typically ending with `/mcp`. The `audiences` value must match the `aud` claim in Descope-issued tokens, which equals your MCP server's resource URL.

## Descope setup

1. Create a project in the [Descope Console](https://app.descope.com/).

2. Note your **Project ID** from **Project Settings** — this is used in your issuer URL and JWKS URL.

3. Create an [MCP Server](https://docs.descope.com/agentic-identity-hub/core-components/mcp-servers) in the Descope Console to represent your MCP gateway. Set the **MCP Server URL** to match the public URL agentgateway exposes (typically ending with `/mcp`), and define the scopes your server enforces.

4. Copy the **Issuer URL** from the MCP Server **Connection Information** section — use this value for `mcpAuthentication.issuer` in agentgateway.

5. For machine-to-machine access, [create a Client](https://docs.descope.com/agentic-identity-hub/core-components/clients#creating-a-client) manually and enable the [**Client Credentials** grant type](https://docs.descope.com/agentic-identity-hub/core-components/clients#client-credentials). Note the generated **Client ID** and **Client Secret**.

## Getting a token

### Machine-to-machine (Clients)

Exchange your Client credentials for a JWT using the [client credentials flow](https://docs.descope.com/agentic-identity-hub/auth-patterns#autonomous-access). Use the **token endpoint** shown in your MCP Server **Connection Information** section:

```bash
curl -X POST \
  <YOUR_TOKEN_ENDPOINT> \
  -H "Content-Type: application/x-www-form-urlencoded" \
  -d "grant_type=client_credentials" \
  -d "client_id=<YOUR_CLIENT_ID>" \
  -d "client_secret=<YOUR_CLIENT_SECRET>" \
  -d "scope=openid read:all" \
  -d "resource=<YOUR_MCP_SERVER_URL>"
```

- `<YOUR_TOKEN_ENDPOINT>`: Copy from the **Connection Information** section of your MCP Server configuration.
- `<YOUR_CLIENT_ID>` / `<YOUR_CLIENT_SECRET>`: From the [Client](https://docs.descope.com/agentic-identity-hub/core-components/clients) you created with the Client Credentials grant type enabled.
- `resource`: Must match your MCP Server URL so the token's `aud` claim targets your server.

### Using the token

```bash
curl <YOUR_MCP_SERVER_URL> \
  -H "Authorization: Bearer YOUR_ACCESS_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"jsonrpc":"2.0","method":"initialize","params":{"protocolVersion":"2024-11-05","capabilities":{}},"id":1}'
```

## Role-based authorization

Use Descope roles with agentgateway authorization:

```yaml
policies:
  mcpAuthentication:
    mode: strict
    issuer: <YOUR_ISSUER_URL>
    audiences: [<YOUR_MCP_SERVER_URL>]
    jwks:
      url: https://api.descope.com/<YOUR_PROJECT_ID>/.well-known/jwks.json
  authorization:
    rules:
      # Check for a specific Descope role
      # - '"Tenant Admin" in jwt.roles'
```

## Learn more

- [Descope MCP Servers](https://docs.descope.com/agentic-identity-hub/core-components/mcp-servers)
- [Descope Clients](https://docs.descope.com/agentic-identity-hub/core-components/clients)
- [Descope MCP authorization](https://docs.descope.com/mcp)
- [MCP authentication]({{< link-hextra path="/configuration/security/mcp-authn" >}})
