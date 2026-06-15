---
title: Descope
weight: 40
description: Integrate agentgateway with Descope for authentication and identity management
---

[Descope](https://www.descope.com/) is an authentication and user management platform. agentgateway can validate JWTs issued by Descope to protect your MCP servers.

## Why use Descope with agentgateway?

- **Passwordless auth** - Magic links, passkeys, biometrics, and OTP out of the box
- **MFA** - Flexible multi-factor authentication flows
- **Social login** - Google, GitHub, Microsoft, and more
- **Enterprise SSO** - SAML and OIDC-based SSO for B2B use cases
- **No-code flows** - Build auth flows visually without writing backend code

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
      issuer: https://api.descope.com/<YOUR_PROJECT_ID>
      audiences: [<YOUR_AUDIENCE>]
      jwks:
        url: https://api.descope.com/<YOUR_PROJECT_ID>/.well-known/jwks.json
      resourceMetadata:
        resource: http://localhost:3000/mcp
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

Replace `<YOUR_PROJECT_ID>` with your Descope project ID (found in the Descope Console under **Project Settings**) and `<YOUR_AUDIENCE>` with the audience configured for your application.

## Descope setup

1. Create a project in the [Descope Console](https://app.descope.com/).

2. Note your **Project ID** from **Project Settings** — this is used as the path component in your issuer URL and JWKS URL.

3. Create an application or flow that issues access tokens with the appropriate audience and scopes for your use case.

4. For machine-to-machine access, create an access key under **Access Keys** in the console.

## Getting a token

### Machine-to-machine (access keys)

Exchange a Descope access key for a JWT:

```bash
curl -X POST \
  https://<your-descope-base-url>/oauth2/v1/apps/token/oauth2/v1/apps/token \
  -H "Content-Type: application/x-www-form-urlencoded" \
  -d "grant_type=client_credentials" \
  -d "client_id=YOUR_CLIENT_ID" \
  -d "client_secret=YOUR_CLIENT_SECRET" \
  -d "scope=..."
```

### Using the token

```bash
curl http://localhost:3000/mcp \
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
    issuer: https://api.descope.com/<YOUR_PROJECT_ID>
    audiences: [<YOUR_AUDIENCE>]
    jwks:
      url: https://api.descope.com/<YOUR_PROJECT_ID>/.well-known/jwks.json
  authorization:
    rules:
    # Check for a specific Descope role
    - '"ai-user" in jwt.roles'
```

## Learn more

- [Descope Documentation](https://docs.descope.com/)
- [MCP authentication]({{< link-hextra path="/configuration/security/mcp-authn" >}})
