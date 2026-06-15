---
title: Auth0
weight: 30
description: Use Auth0 access tokens with agentgateway
---

[Auth0](https://auth0.com/) is an identity platform that provides authentication and authorization services. agentgateway can validate access tokens issued by Auth0 with `mcpAuthentication`.

## Why use Auth0 with agentgateway?

- **Managed identity** - No infrastructure to maintain
- **Social login** - Google, GitHub, Microsoft, and more
- **Enterprise SSO** - SAML, LDAP, Active Directory
- **MFA** - Built-in multi-factor authentication
- **API protection** - JWT-based token validation for MCP services

## Configuration

Configure agentgateway to validate Auth0 tokens and publish MCP protected-resource metadata:

```yaml
# yaml-language-server: $schema=https://agentgateway.dev/schema/config
binds:
- port: 3000
  listeners:
  - routes:
    - backends:
      - mcp:
          targets:
          - name: my-server
            stdio:
              cmd: npx
              args: ["@modelcontextprotocol/server-everything"]
      matches:
      - path:
          exact: /mcp
      - path:
          exact: /.well-known/oauth-protected-resource/mcp
      policies:
        mcpAuthentication:
          issuer: https://your-tenant.auth0.com/
          jwks:
            url: https://your-tenant.auth0.com/.well-known/jwks.json
          resourceMetadata:
            resource: https://gateway.example.com/mcp
            scopesSupported:
            - read:all
            bearerMethodsSupported:
            - header
```

## Auth0 setup

1. Create an API in the Auth0 Dashboard:
   - Name: `agentgateway API`
   - Identifier: `https://api.example.com`

2. Create an Application:
   - Type: Single Page Application or Machine to Machine
   - Note the Client ID and Client Secret

3. Configure the allowed callbacks and origins for any browser clients that will obtain tokens from Auth0.

## Getting a token

### Machine-to-machine

```bash
curl -X POST "https://your-tenant.auth0.com/oauth/token" \
  -H "Content-Type: application/json" \
  -d '{
    "client_id": "YOUR_CLIENT_ID",
    "client_secret": "YOUR_CLIENT_SECRET",
    "audience": "https://api.example.com",
    "grant_type": "client_credentials"
  }'
```

### Using the token

```bash
curl http://localhost:3000/mcp \
  -H "Authorization: Bearer YOUR_ACCESS_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"jsonrpc":"2.0","method":"initialize",...}'
```

## Authorization

Auth0 does not require a provider-specific authorization schema in agentgateway. If you need authorization, use the generic [HTTP authorization]({{< link-hextra path="/configuration/security/http-authz" >}}) or [MCP authorization]({{< link-hextra path="/mcp/mcp-authz" >}}) policies against claims that your Auth0 tenant actually emits.

## Learn more

- [Auth0 Documentation](https://auth0.com/docs)
- [MCP authentication]({{< link-hextra path="/configuration/security/mcp-authn" >}})
- [HTTP authorization]({{< link-hextra path="/configuration/security/http-authz" >}})
- [MCP authorization]({{< link-hextra path="/mcp/mcp-authz" >}})
