---
title: Okta
weight: 50
description: Integrate Agent Gateway with Okta for enterprise identity management
---

[Okta](https://www.okta.com/) is an enterprise identity platform. Agent Gateway can validate JWTs issued by Okta for API authentication.

## Why use Okta with Agent Gateway?

- **Enterprise SSO** - Centralized identity for organizations
- **Directory integration** - Active Directory, LDAP sync
- **Lifecycle management** - Automated provisioning/deprovisioning
- **Compliance** - SOC 2, HIPAA, FedRAMP certified
- **API Access Management** - OAuth2/OIDC for APIs

## Configuration

Configure Agent Gateway to validate Okta JWTs:

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
          issuer: https://your-org.okta.com/oauth2/default
          audiences:
          - api://agentgateway
          jwks:
            url: https://your-org.okta.com/oauth2/default/v1/keys
```

## Okta setup

1. Create an Authorization Server (or use `default`):
   - Admin Console → Security → API → Authorization Servers

2. Add a custom scope:
   - Name: `agentgateway`
   - Description: Access to Agent Gateway

3. Create an API Services application:
   - Applications → Create App Integration
   - Sign-in method: API Services
   - Note the Client ID and Client Secret

4. Grant the scope to your application

## Getting a token

```bash
curl -X POST "https://your-org.okta.com/oauth2/default/v1/token" \
  -H "Content-Type: application/x-www-form-urlencoded" \
  -d "grant_type=client_credentials" \
  -d "client_id=YOUR_CLIENT_ID" \
  -d "client_secret=YOUR_CLIENT_SECRET" \
  -d "scope=agentgateway"
```

## Group-based authorization

Use Okta groups with Agent Gateway authorization:

```yaml
policies:
  mcpAuthentication:
    mode: strict
    issuer: https://your-org.okta.com/oauth2/default
    audiences: [api://agentgateway]
    jwks:
      url: https://your-org.okta.com/oauth2/default/v1/keys
  authorization:
    rules:
    # Check for Okta group membership
    - if: '"AI-Users" in auth.claims.groups'
```

## Learn more

- [Okta Developer Documentation](https://developer.okta.com/docs/)
- [MCP Authentication Tutorial](/docs/tutorials/mcp-authentication)
