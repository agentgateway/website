---
title: Auth0
weight: 30
description: Integrate Agent Gateway with Auth0 for identity management
---

[Auth0](https://auth0.com/) is an identity platform that provides authentication and authorization services. Agent Gateway can validate JWTs issued by Auth0.

## Why use Auth0 with Agent Gateway?

- **Managed identity** - No infrastructure to maintain
- **Social login** - Google, GitHub, Microsoft, and more
- **Enterprise SSO** - SAML, LDAP, Active Directory
- **MFA** - Built-in multi-factor authentication
- **API protection** - JWT-based API authentication

## Configuration

Configure Agent Gateway to validate Auth0 JWTs:

```yaml
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
      policies:
        mcpAuthentication:
          mode: strict
          issuer: https://your-tenant.auth0.com/
          audiences:
          - https://api.example.com
          jwks:
            url: https://your-tenant.auth0.com/.well-known/jwks.json
```

## Auth0 setup

1. Create an API in Auth0 Dashboard:
   - Name: `Agent Gateway API`
   - Identifier: `https://api.example.com`

2. Create an Application:
   - Type: Single Page Application or Machine to Machine
   - Note the Client ID and Client Secret

3. Configure allowed callbacks and origins

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

## Permission-based authorization

Use Auth0 permissions with Agent Gateway:

```yaml
policies:
  mcpAuthentication:
    mode: strict
    issuer: https://your-tenant.auth0.com/
    audiences: [https://api.example.com]
    jwks:
      url: https://your-tenant.auth0.com/.well-known/jwks.json
  authorization:
    rules:
    # Check for specific permission
    - if: '"read:tools" in auth.claims.permissions'
```

## Learn more

- [Auth0 Documentation](https://auth0.com/docs)
- [MCP Authentication Tutorial](/docs/tutorials/mcp-authentication)
