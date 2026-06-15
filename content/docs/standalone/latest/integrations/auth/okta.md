---
title: Okta
weight: 50
description: Use Okta access tokens with agentgateway
---

[Okta](https://www.okta.com/) is an enterprise identity platform. agentgateway can validate access tokens issued by Okta with `mcpAuthentication`.

## Why use Okta with agentgateway?

- **Enterprise SSO** - Centralized identity for organizations
- **Directory integration** - Active Directory, LDAP sync
- **Lifecycle management** - Automated provisioning/deprovisioning
- **Compliance** - SOC 2, HIPAA, FedRAMP certified
- **API protection** - JWT-based token validation for MCP services

## Configuration

Configure agentgateway to validate Okta tokens and publish MCP protected-resource metadata:

```yaml
# yaml-language-server: $schema=https://agentgateway.dev/schema/config
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
      policies:
        mcpAuthentication:
          mode: strict
          issuer: https://your-org.okta.com/oauth2/default
          audiences:
          - api://agentgateway
          jwks:
            url: https://your-org.okta.com/oauth2/default/v1/keys
          resourceMetadata:
            resource: https://gateway.example.com/mcp
            scopesSupported:
            - agentgateway
            bearerMethodsSupported:
            - header
```

## Okta setup

1. Create an Authorization Server or use `default`:
   - Admin Console > Security > API > Authorization Servers

2. Add a custom scope:
   - Name: `agentgateway`
   - Description: Access to agentgateway

3. Create an API Services application:
   - Applications > Create App Integration
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

## Using the token

```bash
curl http://localhost:3000/mcp \
  -H "Authorization: Bearer YOUR_ACCESS_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"jsonrpc":"2.0","method":"initialize",...}'
```

## Authorization

Okta does not require a provider-specific authorization schema in agentgateway. If you need authorization, use the generic [HTTP authorization]({{< link-hextra path="/configuration/security/http-authz" >}}) or [MCP authorization]({{< link-hextra path="/mcp/mcp-authz" >}}) policies against claims that your Okta authorization server actually emits. Avoid copying group-claim rules unless you have confirmed the claim is present in your tokens.

## Learn more

- [Okta Developer Documentation](https://developer.okta.com/)
- [MCP authentication]({{< link-hextra path="/configuration/security/mcp-authn" >}})
- [HTTP authorization]({{< link-hextra path="/configuration/security/http-authz" >}})
- [MCP authorization]({{< link-hextra path="/mcp/mcp-authz" >}})
