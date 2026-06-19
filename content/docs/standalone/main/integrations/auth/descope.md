---
title: Descope
weight: 40
description: Integrate agentgateway with Descope for authentication and identity management
---

[Descope](https://www.descope.com/) is an authentication and user management platform. agentgateway can validate JWTs issued by Descope to protect your MCP servers.

## Why use Descope with agentgateway?

- **Passwordless auth** - [Magic links, passkeys, biometrics, and OTP](https://docs.descope.com/auth-methods) out of the box
- **MFA** - Flexible [multi-factor authentication](https://docs.descope.com/mfa-and-step-up/mfa) flows
- **Social login** - Google, GitHub, Microsoft, and more
- **Enterprise SSO** - [SAML and OIDC-based SSO](https://docs.descope.com/auth-methods/sso) for B2B use cases
- **No-code flows** - Build auth flows visually without writing backend code

## Descope MCP Server

Descope also offers a hosted [MCP Server](https://docs.descope.com/mcp/mcp-server) at `https://mcp.descope.com`. Connect it to your MCP client to manage your Descope project — users, tenants, flows, audit logs, and more — using natural language. No installation required.

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
      audiences: [https://<YOUR_MCP_SERVER_URL>/mcp]
      jwks:
        url: https://api.descope.com/<YOUR_PROJECT_ID>/.well-known/jwks.json
      resourceMetadata:
        resource: https://<YOUR_MCP_SERVER_URL>/mcp
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

- `<YOUR_ISSUER_URL>`: Copy this from the Descope Console under your **Inbound Apps** → **App** → **Connection Information** → **Issuer**. The exact format is system-generated and varies by integration type.
- `<YOUR_PROJECT_ID>`: Found in the Descope Console under **Project Settings**. The JWKS URL always uses the project ID.
- `<YOUR_MCP_SERVER_URL>`: Your MCP server's public URL. The `audiences` value must match the `aud` claim in Descope-issued tokens, which equals your MCP server's resource URL.

## Descope setup

1. Create a project in the [Descope Console](https://app.descope.com/).

2. Note your **Project ID** from **Project Settings** — this is used as the path component in your issuer URL and JWKS URL.

3. Create an [Inbound App](https://docs.descope.com/identity-federation/inbound-apps/creating-inbound-apps) in the Descope Console to represent your MCP server, or configure a [flow](https://docs.descope.com/flows) that issues access tokens with the appropriate audience and scopes for your use case.

4. For machine-to-machine access, enable the [**Client Credentials** flow](https://docs.descope.com/identity-federation/inbound-apps/using-inbound-apps#client-credentials-flow) on the Inbound App and note the generated **Client ID** and **Client Secret**.

## Getting a token

### Machine-to-machine (Inbound Apps)

Exchange your Inbound App client credentials for a JWT using the [client credentials flow](https://docs.descope.com/identity-federation/inbound-apps/using-inbound-apps#example-fetching-a-token-using-client-credentials):

```bash
curl -X POST \
  https://api.descope.com/oauth2/v1/apps/token \
  -H "Content-Type: application/x-www-form-urlencoded" \
  -d "grant_type=client_credentials" \
  -d "client_id=<YOUR_CLIENT_ID>" \
  -d "client_secret=<YOUR_CLIENT_SECRET>" \
  -d "scope=openid read:all" \
  -d "audience=https://<YOUR_MCP_SERVER_URL>/mcp"
```

### Using the token

```bash
curl https://<YOUR_MCP_SERVER_URL>/mcp \
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
    audiences: [https://<YOUR_MCP_SERVER_URL>/mcp]
    jwks:
      url: https://api.descope.com/<YOUR_PROJECT_ID>/.well-known/jwks.json
  authorization:
    rules:
    # Check for a specific Descope role
    - '"ai-user" in jwt.roles'
```

## Learn more

- [Descope Inbound Apps](https://docs.descope.com/identity-federation/inbound-apps)
- [Descope MCP authorization](https://docs.descope.com/mcp)
- [MCP authentication]({{< link-hextra path="/configuration/security/mcp-authn" >}})
