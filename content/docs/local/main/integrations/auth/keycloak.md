---
title: Keycloak
weight: 20
description: Integrate Agent Gateway with Keycloak for identity management
---

[Keycloak](https://www.keycloak.org/) is an open-source identity and access management solution. Agent Gateway can validate JWTs issued by Keycloak.

## Why use Keycloak with Agent Gateway?

- **Open source** - Self-hosted identity management
- **Standards-based** - OAuth2, OIDC, SAML support
- **Enterprise features** - User federation, SSO, MFA
- **Fine-grained authorization** - Role and attribute-based access

## Configuration

Configure Agent Gateway to validate Keycloak JWTs:

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
          issuer: https://keycloak.example.com/realms/myrealm
          audiences:
          - agentgateway
          jwks:
            url: https://keycloak.example.com/realms/myrealm/protocol/openid-connect/certs
```

## Docker Compose example

```yaml
version: '3'
services:
  agentgateway:
    image: ghcr.io/agentgateway/agentgateway:latest
    ports:
      - "3000:3000"
    volumes:
      - ./config.yaml:/etc/agentgateway/config.yaml
    depends_on:
      - keycloak

  keycloak:
    image: quay.io/keycloak/keycloak:latest
    ports:
      - "8080:8080"
    environment:
      - KEYCLOAK_ADMIN=admin
      - KEYCLOAK_ADMIN_PASSWORD=admin
    command: start-dev

  postgres:
    image: postgres:15
    environment:
      - POSTGRES_DB=keycloak
      - POSTGRES_USER=keycloak
      - POSTGRES_PASSWORD=keycloak
```

## Keycloak setup

1. Create a realm (e.g., `myrealm`)
2. Create a client for Agent Gateway:
   - Client ID: `agentgateway`
   - Client Protocol: `openid-connect`
   - Access Type: `confidential` or `public`
3. Create users and assign roles

## Role-based authorization

Combine Keycloak roles with Agent Gateway authorization:

```yaml
policies:
  mcpAuthentication:
    mode: strict
    issuer: https://keycloak.example.com/realms/myrealm
    audiences: [agentgateway]
    jwks:
      url: https://keycloak.example.com/realms/myrealm/protocol/openid-connect/certs
  authorization:
    rules:
    # Check for admin role in token
    - if: '"admin" in auth.claims.realm_access.roles'
```

## Learn more

- [Keycloak Documentation](https://www.keycloak.org/documentation)
- [MCP Authentication Tutorial](/docs/tutorials/mcp-authentication)
