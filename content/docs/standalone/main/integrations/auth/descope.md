---
title: Descope
weight: 40
description: Integrate agentgateway with Descope for authentication and identity management
---

[Descope](https://www.descope.com/) is an authentication and user management platform. agentgateway can validate JWTs issued by Descope to protect your MCP servers.

## Why use Descope with agentgateway?

- **MCP-native OAuth 2.1 compliance** - [MCP Servers](https://docs.descope.com/agentic-identity-hub/core-components/mcp-servers) let you protect your MCP gateway with a full OAuth 2.1 compliant provider. [CIMD](https://docs.descope.com/agentic-identity-hub/core-components/mcp-servers/registration-methods#client-id-metadata-documents-cimd) and [DCR](https://docs.descope.com/agentic-identity-hub/core-components/mcp-servers/registration-methods#dynamic-client-registration-dcr) are both supported as registration methods
- **Agent Directory** - View all of your [agentic identities](https://docs.descope.com/agentic-identity-hub/core-components/agents) within one centralized IAM platform
- **Machine-to-machine access** - [Client credentials flow](https://docs.descope.com/agentic-identity-hub/core-components/clients#client-credentials) for agents and backends that need unattended access
- **Policies** - Enforce [policy](https://docs.descope.com/identity-federation/policies) rules for agent access to downstream services, in conjunction with agentgateway authorization rules using JWT `roles` claims
- **User consent for agents** - [Visual consent flows](https://docs.descope.com/flows) let users explicitly approve which MCP scopes and tools an agent can access

## Configuration

Configure agentgateway to validate Descope JWTs:

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

2. Note your **Project ID** from **Project Settings**. The project ID is used in your issuer URL and JWKS URL.

3. Create an [MCP Server](https://docs.descope.com/agentic-identity-hub/core-components/mcp-servers) in the Descope Console to represent your MCP gateway. Set the **MCP Server URL** to match the public URL agentgateway exposes (typically ending with `/mcp`), and define the scopes your server enforces. The MCP Server includes a built-in [User Consent Flow](https://docs.descope.com/agentic-identity-hub/core-components/mcp-servers/settings#user-consent-flow) for interactive, user-delegated access. Customize it under **Server Settings** if you need a different login or consent experience.

4. Copy the **Issuer URL** from the MCP Server **Connection Information** section. Use this value for `mcpAuthentication.issuer` in agentgateway.

5. If you also need machine-to-machine access (for backend agents or automated testing), [create a Client](https://docs.descope.com/agentic-identity-hub/core-components/clients#creating-a-client) manually and enable the [**Client Credentials** grant type](https://docs.descope.com/agentic-identity-hub/core-components/clients#client-credentials). Note the generated **Client ID** and **Client Secret**.

## Getting a token

How a client gets a token depends on whether it acts for a user or on its own behalf. These are different paths for interactive clients and machine-to-machine.

### Interactive clients (user-delegated)

MCP clients like Claude, Cursor, or a custom client you build handle this automatically using the OAuth 2.1 authorization code flow with PKCE: the client discovers your MCP Server's OAuth endpoints, registers via CIMD or DCR, and redirects the user through Descope's User Consent Flow to approve scopes. Point the client at your MCP Server URL. No manual token request is needed. See [MCP Servers](https://docs.descope.com/agentic-identity-hub/core-components/mcp-servers) for details.

### Machine-to-machine (testing and automated agents)

For backend agents, scripts, or testing without an interactive client, exchange Client credentials directly for a token using the [client credentials flow](https://docs.descope.com/agentic-identity-hub/auth-patterns#autonomous-access). Set these once, then the commands below are copy-paste runnable:

```bash
export DESCOPE_TOKEN_ENDPOINT=<YOUR_TOKEN_ENDPOINT>
export DESCOPE_CLIENT_ID=<YOUR_CLIENT_ID>
export DESCOPE_CLIENT_SECRET=<YOUR_CLIENT_SECRET>
export MCP_SERVER_URL=<YOUR_MCP_SERVER_URL>
```

- `DESCOPE_TOKEN_ENDPOINT`: Copy from the **Connection Information** section of your MCP Server configuration.
- `DESCOPE_CLIENT_ID` / `DESCOPE_CLIENT_SECRET`: From the [Client](https://docs.descope.com/agentic-identity-hub/core-components/clients) you created with the Client Credentials grant type enabled.
- `MCP_SERVER_URL`: Must match your MCP Server URL so the token's `aud` claim targets your server.

```bash
curl -X POST "$DESCOPE_TOKEN_ENDPOINT" \
  -H "Content-Type: application/x-www-form-urlencoded" \
  -d "grant_type=client_credentials" \
  -d "client_id=$DESCOPE_CLIENT_ID" \
  -d "client_secret=$DESCOPE_CLIENT_SECRET" \
  -d "scope=openid read:all" \
  -d "resource=$MCP_SERVER_URL"
```

Copy the `access_token` from the response, then use it as a bearer token in requests:

```bash
export ACCESS_TOKEN=<TOKEN_FROM_PREVIOUS_RESPONSE>

curl "$MCP_SERVER_URL" \
  -H "Authorization: Bearer $ACCESS_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"jsonrpc":"2.0","method":"initialize","params":{"protocolVersion":"2024-11-05","capabilities":{}},"id":1}'
```

## Role-based authorization

You can use authorization with agentgateway based on your existing Descope roles, such as `Tenant Admin` in the following example:

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
```

{{< callout type="info" >}}
Checking for a specific Descope role will depend on your [Authorization Claims Configuration](https://docs.descope.com/management/token/jwt-templates#authorization-claims-configuration).

If using the Default Descope JWT, then roles will be found in `jwt.tenants["<YOUR TENANT ID>"].roles`, otherwise if using No Tenant Reference authorization claim format, then you can expect to find them in `jwt.roles`.
{{< /callout >}}

## Learn more

- [Descope MCP Servers](https://docs.descope.com/agentic-identity-hub/core-components/mcp-servers)
- [Descope Clients](https://docs.descope.com/agentic-identity-hub/core-components/clients)
- [Descope MCP authorization](https://docs.descope.com/mcp)
- [MCP authentication]({{< link-hextra path="/configuration/security/mcp-authn" >}})
