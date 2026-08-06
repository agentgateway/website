---
title: Keycloak
weight: 20
description: Protect MCP servers with Keycloak as the authorization server.
test:
  keycloak-mcp-authn:
  - file: ${versionRoot}/integrations/auth/keycloak.md
    path: keycloak-mcp-authn
---

[Keycloak](https://www.keycloak.org/) is an open source identity and access management solution. Agentgateway includes a native `keycloak` MCP authentication provider so that you can use Keycloak as the authorization server for your MCP servers.

## Why the Keycloak provider is needed {#why}

MCP clients follow the [MCP authorization specification](https://modelcontextprotocol.io/specification/draft/basic/authorization), which relies on OAuth behaviors that Keycloak implements differently. Keycloak serves neither keys nor metadata at the standard OAuth locations.

When you set `provider.keycloak`, agentgateway bridges these gaps as follows:

- Fetches keys from `{issuer}/protocol/openid-connect/certs`, the non-standard endpoint that Keycloak uses instead of `{issuer}/.well-known/jwks.json`.
- Serves authorization server metadata from Keycloak's OpenID Connect discovery document, because Keycloak does not implement [RFC 8414](https://www.rfc-editor.org/rfc/rfc8414).
- Proxies Dynamic Client Registration through the gateway, because Keycloak does not send CORS headers on its registration endpoint ([keycloak#39629](https://github.com/keycloak/keycloak/issues/39629)).

For the underlying `mcpAuthentication` fields, see [MCP authentication]({{< link-hextra path="/configuration/security/mcp-authn" >}}).

## Why use Keycloak with agentgateway? {#why-keycloak}

- **Open source**: Self-hosted identity management.
- **Standards based**: Support for OAuth 2.0, OpenID Connect (OIDC), and Security Assertion Markup Language (SAML).
- **Enterprise features**: User federation, single sign-on (SSO), and multi-factor authentication (MFA).
- **Fine-grained authorization**: Role-based and attribute-based access.

## Before you begin {#before-you-begin}

- [Install agentgateway]({{< link-hextra path="/deployment/binary" >}}).
- A Keycloak instance that agentgateway can reach. To run one locally, see [Run Keycloak locally](#docker-compose).
- Permission to create a realm and a client in Keycloak.

## Set up Keycloak {#register}

Create a realm and a client in Keycloak, and collect the values that agentgateway needs.

1. Make sure that you have access to a Keycloak instance that agentgateway can reach. To run one locally for testing, see [Run Keycloak locally](#docker-compose).

2. Log in to the Keycloak admin console and create a realm, such as `myrealm`. The realm name appears in the issuer URL, which takes the form `https://<keycloak-host>/realms/<realm>`.

3. Create a client for your MCP clients. Set the **Client ID** to a value such as `agentgateway`, and set the client protocol to `openid-connect`. MCP clients are public clients that use PKCE, because they cannot keep a client secret.

4. Under the client's **Settings**, add the callback URLs of the MCP clients that you plan to connect as valid redirect URIs.

5. Create the users and roles that your MCP server enforces, then assign the roles to your users. You reference these roles in [authorization rules](#authorization).

### Run Keycloak locally {#docker-compose}

To test against a local Keycloak, run agentgateway and Keycloak together with Docker Compose. The `start-dev` command runs Keycloak with an embedded database, which is suitable for testing but not for production.

```yaml
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
```

## Configure agentgateway {#configure}

Configure the `mcpAuthentication` policy with the `keycloak` provider.

```yaml
# yaml-language-server: $schema=https://agentgateway.dev/schema/config
gateways:
  default:
    port: 3000
routes:
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
      provider:
        keycloak: {}
      resourceMetadata:
        resource: agentgateway
        scopesSupported:
        - read:all
        bearerMethodsSupported:
        - header
```

Review the following configuration details:

- `issuer`: The realm URL, in the form `https://<keycloak-host>/realms/<realm>`. This value must match the `iss` claim in the token.
- `audiences`: The audience that your Keycloak realm issues. Keycloak does not support [RFC 8707](https://www.rfc-editor.org/rfc/rfc8707) resource indicators ([keycloak#10169](https://github.com/keycloak/keycloak/issues/10169)), and agentgateway has no workaround for this, so you must set the audience that the realm already mints.
- `jwks`: Optional. Because `provider.keycloak` is set, agentgateway derives the JWKS URL from the issuer. To fetch keys from somewhere else, such as a local file or an internal mirror, set `jwks` explicitly to override the derived URL.

## Connect an MCP client {#connect}

Point your MCP client at the gateway's MCP endpoint, such as `http://localhost:3000/mcp`. The client discovers the authorization server through the gateway, registers through the gateway-proxied registration endpoint, and redirects the user to Keycloak to log in and consent.

## Role-based authorization {#authorization}

Because MCP authentication runs at the route level, you can use claims from the validated Keycloak token in an [authorization]({{< link-hextra path="/configuration/security/mcp-authz" >}}) policy. For example, check for a realm role:

```yaml
policies:
  mcpAuthentication:
    mode: strict
    issuer: https://keycloak.example.com/realms/myrealm
    audiences: [agentgateway]
    provider:
      keycloak: {}
    resourceMetadata:
      resource: agentgateway
      scopesSupported:
      - read:all
      bearerMethodsSupported:
      - header
  authorization:
    rules:
    # Check for admin role in token
    - '"admin" in jwt.realm_access.roles'
```

## Learn more

- [Keycloak documentation](https://www.keycloak.org/documentation)
- [MCP authentication]({{< link-hextra path="/configuration/security/mcp-authn" >}})
- [MCP authorization]({{< link-hextra path="/configuration/security/mcp-authz" >}})

{{< doc-test paths="keycloak-mcp-authn" >}}
{{< reuse "agw-docs/snippets/install-agentgateway-binary.md" >}}
{{< /doc-test >}}

{{< doc-test paths="keycloak-mcp-authn" >}}
# WHAT THIS TEST VALIDATES:
#   * The Keycloak mcpAuthentication examples on this page (issuer, audiences,
#     the keycloak provider, and resourceMetadata) are accepted by agentgateway,
#     including the role-based authorization variant.
#   * The test points jwks at a local file instead of letting agentgateway derive
#     the Keycloak certs URL, so it runs without a live Keycloak instance.
# WHAT THIS TEST DOES NOT VALIDATE (and why):
#   * Resolution of the derived JWKS URL, the proxied authorization-server
#     metadata, and runtime token verification. Each of these requires a live
#     Keycloak realm and a signed JWT that this page does not stand up.
mkdir -p manifests/jwt
cat <<'EOF' > manifests/jwt/pub-key
{"keys": [{"kty": "RSA", "kid": "test", "use": "sig", "alg": "RS256", "n": "teXe4sfDoHQR5YUos3nsY_Ax6J2xrgXnIfUziaTWJ4nljejLVyg8m0g6SK9zrSaCvLm9GxAhpaJ_48RalwqDt4spBPQ8uvr-54jHrECboAbTxhy2T-oXP80Duz0xauSDVlyA_xenoCA24MFJ1rgHppy1F1eYTD-CQ-IxhXLNm5mE3rJufP_pdnMy0q6acXSfPtEzMJY3BYNV5umqimkOgH9PqQWd1RAgYdE7z5fvdCb4T4K667rRRT75PqRB4GJgSY-zQrC4CEVCw_ql7bfdouFcxXwsyh7AfImIEamA1LMODvMXVZWkZ8V0w_VEK6NHqr-BGOBVAUfRqYAEPxfaIw", "e": "AQAB"}]}
EOF
cat <<'EOF' > config-keycloak.yaml
gateways:
  default:
    port: 3000
routes:
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
      provider:
        keycloak: {}
      jwks:
        file: ./manifests/jwt/pub-key
      resourceMetadata:
        resource: agentgateway
        scopesSupported:
        - read:all
        bearerMethodsSupported:
        - header
    authorization:
      rules:
      - '"admin" in jwt.realm_access.roles'
EOF
agentgateway -f config-keycloak.yaml --validate-only
{{< /doc-test >}}
