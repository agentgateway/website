---
title: OIDC browser authentication
weight: 40
description: Enable browser-based OpenID Connect authentication with encrypted session cookies.
---

Attaches to: {{< badge content="Route" path="/documentation/configuration/routes/">}}

{{< reuse "agw-docs/snippets/config-styles-note.md" >}}

OIDC browser authentication provides built-in OpenID Connect login for browser-based clients. By default, unauthenticated browser navigations are redirected to the identity provider's login page. You can also redirect browser navigations to a local login page before the identity provider flow starts. To end the local session, add a local logout endpoint that clears the gateway session.

The OIDC policy uses the OAuth 2.0 Authorization Code Flow with PKCE (Proof Key for Code Exchange) for secure browser-based authentication without requiring a separate proxy like oauth2-proxy.

## About

The following diagram shows the OIDC browser authentication flow between the browser, agentgateway, and identity provider.

```mermaid
sequenceDiagram
    autonumber
    participant Browser
    participant AGW as Agentgateway
    participant IdP as Identity Provider

    Browser->>AGW: Request protected resource
    AGW->>AGW: No valid session cookie found
    AGW->>Browser: 302 Redirect to IdP login<br/>(with PKCE code_challenge)
    Browser->>IdP: Follow redirect to login page
    IdP->>Browser: Display login form
    Browser->>IdP: Submit credentials
    IdP->>Browser: 302 Redirect to redirectURI<br/>(with authorization code)
    Browser->>AGW: GET /oauth/callback?code=...
    AGW->>IdP: Exchange code for ID token<br/>(with PKCE code_verifier)
    IdP->>AGW: Return ID token
    AGW->>AGW: Validate ID token with JWKS
    AGW->>Browser: Set encrypted session cookie<br/>and redirect to original resource
    Browser->>AGW: Request with session cookie
    AGW->>AGW: Decrypt and validate cookie
    AGW->>Browser: Return protected resource
```

* **Steps 1-3: Unauthenticated request**. When a browser request arrives without a valid session cookie, the gateway redirects the user to the identity provider's login page.
* **Steps 4-6: Login**. The user authenticates with the identity provider.
* **Steps 7-8: Callback**. After login, the identity provider redirects back to the `redirectURI` with an authorization code.
* **Steps 9-11: Token exchange**. The gateway exchanges the authorization code for an ID token using PKCE.
* **Steps 12-15: Session cookie**. The gateway sets an encrypted session cookie containing the ID token claims. Subsequent requests use this cookie.

### Session management

Review the following details about session management.

- Session cookies are encrypted and tamper-proof.
- The gateway always requests the `openid` scope to obtain an ID token.
- The gateway uses PKCE automatically to protect against authorization code interception.

## Configuration

Add the `oidc` policy to a route to protect it with browser-based OIDC authentication.

Agentgateway requires the `OIDC_COOKIE_SECRET` environment variable to encrypt session cookies when an `oidc` policy is configured. Set it to a random value before you start the gateway, such as in the following example.

```bash
export OIDC_COOKIE_SECRET="$(python3 -c 'import os; print(os.urandom(32).hex())')"
```

{{< tabs >}}
{{< tab name="Simplified (LLM)" >}}
```yaml
# yaml-language-server: $schema=https://agentgateway.dev/schema/config
llm:
  policies:
    oidc:
      issuer: http://localhost:7080/realms/agentgateway
      clientId: agentgateway-browser
      clientSecret: agentgateway-secret
      redirectURI: http://localhost:3000/oauth/callback
      scopes:
      - profile
      - email
  models:
  - name: "*"
    provider: openAI
    params:
      apiKey: "$OPENAI_API_KEY"
```
{{< /tab >}}
{{< tab name="Simplified (MCP)" >}}
```yaml
# yaml-language-server: $schema=https://agentgateway.dev/schema/config
mcp:
  port: 3000
  policies:
    oidc:
      issuer: http://localhost:7080/realms/agentgateway
      clientId: agentgateway-browser
      clientSecret: agentgateway-secret
      redirectURI: http://localhost:3000/oauth/callback
      scopes:
      - profile
      - email
  targets:
  - name: everything
    stdio:
      cmd: npx
      args: ["@modelcontextprotocol/server-everything"]
```
{{< /tab >}}
{{< tab name="Routing-based" >}}
```yaml
# yaml-language-server: $schema=https://agentgateway.dev/schema/config
gateways:
  default:
    port: 3000
routes:
- backends:
  - host: localhost:18080
  matches:
  - path:
      pathPrefix: /
  policies:
    oidc:
      issuer: http://localhost:7080/realms/agentgateway
      clientId: agentgateway-browser
      clientSecret: agentgateway-secret
      redirectURI: http://localhost:3000/oauth/callback
      scopes:
      - profile
      - email
```
{{< /tab >}}
{{< /tabs >}}

### Keycloak example

Review the following example for a Keycloak IdP.

{{< tabs >}}
{{< tab name="Simplified (LLM)" >}}
```yaml
# yaml-language-server: $schema=https://agentgateway.dev/schema/config
llm:
  policies:
    oidc:
      issuer: http://keycloak.example.com/realms/myrealm
      clientId: agentgateway-browser
      clientSecret: my-client-secret
      redirectURI: http://localhost:3000/oauth/callback
      scopes:
      - profile
      - email
  models:
  - name: "*"
    provider: openAI
    params:
      apiKey: "$OPENAI_API_KEY"
```
{{< /tab >}}
{{< tab name="Simplified (MCP)" >}}
```yaml
# yaml-language-server: $schema=https://agentgateway.dev/schema/config
mcp:
  port: 3000
  policies:
    oidc:
      issuer: http://keycloak.example.com/realms/myrealm
      clientId: agentgateway-browser
      clientSecret: my-client-secret
      redirectURI: http://localhost:3000/oauth/callback
      scopes:
      - profile
      - email
  targets:
  - name: everything
    stdio:
      cmd: npx
      args: ["@modelcontextprotocol/server-everything"]
```
{{< /tab >}}
{{< tab name="Routing-based" >}}
```yaml
# yaml-language-server: $schema=https://agentgateway.dev/schema/config
gateways:
  default:
    port: 3000
routes:
- backends:
  - host: localhost:18080
  matches:
  - path:
      pathPrefix: /
  policies:
    oidc:
      issuer: http://keycloak.example.com/realms/myrealm
      clientId: agentgateway-browser
      clientSecret: my-client-secret
      redirectURI: http://localhost:3000/oauth/callback
      scopes:
      - profile
      - email
```
{{< /tab >}}
{{< tab name="traffic-oidc example" >}}
For a complete runnable setup, including a Compose file that starts a preconfigured local Keycloak instance, see the [`traffic-oidc` example](https://github.com/agentgateway/agentgateway/tree/main/examples/traffic-oidc) in the agentgateway repository.

{{% github-yaml url="https://agentgateway.dev/examples/traffic-oidc/config.yaml" %}}
{{< /tab >}}
{{< /tabs >}}

## Custom login page and logout {#custom-login-page-and-logout}

Use the optional `login` and `logout` blocks when your application supplies its own sign-in page or sign-out control. The `login.path` endpoint starts the OIDC flow. The `login.redirect` path sends unauthenticated browser navigations to your application page before the OIDC flow starts.

```yaml
policies:
  oidc:
    issuer: http://localhost:7080/realms/agentgateway
    clientId: agentgateway-browser
    clientSecret: agentgateway-secret
    redirectURI: http://localhost:3000/oauth/callback
    login:
      path: /auth/login
      redirect: /login
    logout:
      path: /auth/logout
      redirect: /login
```

Serve the page at `login.redirect` on routes that bypass the OIDC policy. Serve any assets that the page needs on public routes too. The `login.redirect` setting does not make the page public. The path is not the OIDC callback or the destination after successful login. When the gateway redirects a browser to `login.redirect`, the redirect includes a `returnTo` query parameter with the original local path and query.

On your sign-in page, link to `login.path` and preserve the `returnTo` value. For example, a request for `/app` can redirect to `/login?returnTo=%2Fapp`. The sign-in link can point to `/auth/login?returnTo=%2Fapp`. If `returnTo` is missing or unsafe, the gateway returns the user to `/`.

Use a same-origin `POST` form for logout, such as the following example.

```html
<form method="post" action="/auth/logout">
  <button type="submit">Sign out</button>
</form>
```

Logout clears the gateway session and login transaction cookies. Logout does not sign the user out of the identity provider or revoke tokens. Requests to `logout.path` must include an `Origin` header that matches the origin of `redirectURI`.

The `login` and `logout` blocks are independent. Omit `login.redirect` to keep automatic redirects to the identity provider. Omit `logout` to disable the local logout endpoint. All endpoint and redirect values must be safe local paths. Endpoint paths must differ from each other and from the callback path.

The built-in UI manages its own `/ui/login`, `/api/auth/login`, and `/api/auth/logout` endpoints. Do not set `login` or `logout` under `ui.policies.oidc`; the configuration is rejected.

## Fields

{{< reuse "agw-docs/snippets/review-table.md" >}}

| Field | Required | Description |
|-------|----------|-------------|
| `issuer` | Yes | OIDC provider issuer URL. Used for discovery and ID token validation. |
| `clientId` | Yes | OAuth2 client identifier registered with your identity provider. |
| `clientSecret` | Yes | OAuth2 client secret for token exchange. |
| `redirectURI` | Yes | Absolute callback URI handled by the gateway, such as `http://localhost:3000/oauth/callback`. |
| `scopes` | No | Additional OAuth2 scopes to request. `openid` is always included automatically. |
| `discovery` | No | Override the OIDC discovery document location. If omitted, uses `${issuer}/.well-known/openid-configuration`. |
| `authorizationEndpoint` | No | Explicit authorization endpoint. Overrides the value from discovery. |
| `tokenEndpoint` | No | Explicit token endpoint. Overrides the value from discovery. |
| `tokenEndpointAuth` | No | Client authentication method for the token endpoint. Discovery mode derives this from provider metadata. Explicit mode defaults to `clientSecretBasic`. |
| `jwks` | No | JWKS source for ID token validation. If omitted, uses the `jwks_uri` from discovery. |
| `login` | No | Optional explicit login endpoint and pre-login redirect block. Omit to keep automatic redirects to the identity provider. |
| `login.path` | Yes, when `login` is set | Local endpoint that starts the OIDC flow, such as `/auth/login`. The endpoint is handled by the policy and is not forwarded to your application. |
| `login.redirect` | No | Local page for unauthenticated browser navigations, such as `/login`. The gateway appends `returnTo` so that the page can preserve the original destination in its link to `login.path`. |
| `logout` | No | Optional local logout endpoint block. Omit to disable local logout. |
| `logout.path` | Yes, when `logout` is set | Local endpoint that clears the policy's session and login transaction cookies, such as `/auth/logout`. Submit logout with a same-origin `POST` form. |
| `logout.redirect` | No | Local destination for the `303` redirect after logout. Defaults to `login.redirect` when set, or `/` when `login.redirect` is omitted. |

## Access log enrichment

After setting up OIDC browser authentication, you can use JWT claims from the OIDC session in access logs. Add a frontend policy such as the following example.

```yaml
frontendPolicies:
  accessLog:
    add:
      user.id: jwt.sub
      user.email: jwt.email
```

## Learn more

- [Keycloak integration]({{< link-hextra path="/integrations/auth/keycloak" >}})
- [Auth0 integration]({{< link-hextra path="/integrations/auth/auth0" >}})
- [MCP authentication]({{< link-hextra path="/documentation/configuration/security/mcp-authn" >}}) for MCP-specific OAuth flows
