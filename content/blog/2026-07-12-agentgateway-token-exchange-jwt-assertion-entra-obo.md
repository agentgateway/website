---
title: "Agentgateway adds token exchange, jwt-assertion, and Entra OBO"
category: "Feature"
publishDate: 2026-07-12
author: "Christian Posta"
description: "Native backend auth for RFC 8693 token exchange, RFC 7523 JWT bearer (jwt-assertion), and Microsoft Entra on-behalf-of — so agents can call downstream APIs as the user without hand-rolled ext_proc or custom agent code"
toc: false
---

Shielding AI agents from sensitive MCP / API credentials (secrets, API keys, tokens, etc) is the prevailing best practice pattern to keep sensitive secrets from leaking into AI model conversations or across AI agent boundaries. OpenClaw, for example, has direct file system access in its most general deployment and can read files/secrets/env variables, etc and could easily send these secrets in any requests.

The right way in an enterprise environment: user identity + agent identity tied to an authorization grant, which determines what is allowed to be done. Any calls to MCP servers or APIs have their credentials injected transparently by the infrastructure. The cornerstone of this injection is exchanging an agent or user's identity for the correct secrets/API keys/tokens.

In the upcoming agentgateway release, we have opensourced two new exchange capabilities, including a bonus third exchange opportunity with Microsoft Entra — all under `backendAuth.oauthTokenExchange`:

| Grant | Spec | Subject sent as | Typical IdP |
|---|---|---|---|
| Token exchange | [RFC 8693](https://datatracker.ietf.org/doc/html/rfc8693) | `subject_token` | Keycloak, Okta, ZITADEL, Auth0, … |
| JWT bearer (jwt-assertion) | [RFC 7523](https://datatracker.ietf.org/doc/html/rfc7523) | `assertion` | Keycloak JWT Authorization Grant, many AS |
| Entra on-behalf-of (OBO) | Entra's OBO (jwt-bearer + extras) | `assertion` | Microsoft Entra ID |

Entra is the important enterprise wrinkle: **it does not speak RFC 8693**. Its OBO flow is jwt-bearer with `requested_token_use=on_behalf_of`. Same outcome (user-scoped downstream token), different grant shape — so both grants live under one `oauthTokenExchange` block.

## RFC 8693 token exchange

Default grant. The gateway POSTs the inbound bearer as `subject_token` to your IdP's token endpoint and attaches the returned access token upstream.

```yaml
backendAuth:
  oauthTokenExchange:
    host: idp.example.com:443
    tokenEndpointPath: /oauth2/default/v1/token
    clientAuth:
      clientId: gateway-client
      clientSecret: $OAUTH_CLIENT_SECRET
      method: clientSecretBasic
    audiences:
    - upstream-api
    scopes:
    - read
```

What the gateway sends (conceptually):

```
grant_type=urn:ietf:params:oauth:grant-type:token-exchange
subject_token=<inbound bearer>
subject_token_type=urn:ietf:params:oauth:token-type:access_token
audience=upstream-api
scope=read
```

Optional knobs that matter in agentic setups:

- **`actorToken`** — RFC 8693 delegation (`act` claim). Useful when an agent identity is acting *for* a user.
- **`resources`** — [RFC 8707](https://datatracker.ietf.org/doc/html/rfc8707) resource indicators when the AS expects them (common for MCP / API audiences).
- **`subjectToken.source`** — read the subject from a non-default header, cookie, or CEL expression instead of `Authorization`.
- **`cache`** — in-memory cache keyed by subject + grant params; TTL capped by the subject JWT `exp`.

Runnable example: [`examples/traffic-token-exchange/oauth-rfc8693`](https://github.com/agentgateway/agentgateway/tree/main/examples/traffic-token-exchange/oauth-rfc8693).

## JWT assertion (RFC 7523 jwt-bearer)

Flip `grantType: jwtBearer` and the same policy speaks JWT bearer instead of token exchange. The inbound credential becomes the `assertion` (not `subject_token`). `requestedTokenType` / `actorToken` are rejected for this grant — they belong to RFC 8693.

```yaml
backendAuth:
  oauthTokenExchange:
    host: idp.example.com:443
    tokenEndpointPath: /realms/backend-oauth/protocol/openid-connect/token
    grantType: jwtBearer
    clientAuth:
      clientId: requester-client
      clientSecret: requester-secret
      method: clientSecretBasic
    audiences:
    - target-client
```

Form shape:

```
grant_type=urn:ietf:params:oauth:grant-type:jwt-bearer
assertion=<inbound token>
audience=target-client
```

This grant works for any authorization servers that support JWT Assertion Grant (RFC 7523). This is the grant Keycloak's [JWT Authorization Grant](https://www.keycloak.org/docs/latest/server_admin/#_jwt-authorization-grant) (preview in 26.5+) implements across realms — present a JWT from realm A, get a token from realm B that trusts A. Full two-realm walkthrough: [`examples/traffic-token-exchange/jwt-authz-grant`](https://github.com/agentgateway/agentgateway/tree/main/examples/traffic-token-exchange/jwt-authz-grant).

## Microsoft Entra OBO

Entra OBO is jwt-bearer with provider-specific extras. The hand-written request looks like:

```bash
curl -X POST "https://login.microsoftonline.com/<TENANT_ID>/oauth2/v2.0/token" \
  -H "Content-Type: application/x-www-form-urlencoded" \
  -d "client_id=<CLIENT_ID>" \
  -d "client_secret=<CLIENT_SECRET>" \
  -d "grant_type=urn:ietf:params:oauth:grant-type:jwt-bearer" \
  -d "requested_token_use=on_behalf_of" \
  -d "scope=https://graph.microsoft.com/.default" \
  -d "assertion=<USER_ACCESS_TOKEN>"
```

Agentgateway produces that same request from config:

```yaml
backendAuth:
  oauthTokenExchange:
    host: login.microsoftonline.com:443
    tokenEndpointPath: /<TENANT_ID>/oauth2/v2.0/token
    grantType: jwtBearer
    clientAuth:
      clientId: <CLIENT_ID>
      clientSecret: <CLIENT_SECRET>
      method: clientSecretPost   # credentials in the BODY (Entra expects this shape)
    scopes:
    - https://graph.microsoft.com/.default
    additionalParams:
      requested_token_use: '"on_behalf_of"'   # CEL string literal
```

| Microsoft form field | Produced by |
|---|---|
| `grant_type=...jwt-bearer` | `grantType: jwtBearer` |
| `assertion=<user token>` | inbound bearer (jwt-bearer sends subject as `assertion`) |
| `scope=...` | `scopes:` (joined into one space-delimited `scope`) |
| `client_id` + `client_secret` in body | `clientAuth.method: clientSecretPost` |
| `requested_token_use=on_behalf_of` | `additionalParams` (CEL) |

Gotchas worth calling out:

- `requested_token_use` is a vendor extension, so it lives in `additionalParams`, not a first-class field. Values are **CEL expressions** — a literal string needs the inner quotes: `'"on_behalf_of"'`.
- Prefer `clientSecretPost` for Entra so credentials land in the form body (matching Microsoft's docs). Default `clientSecretBasic` would put them in an `Authorization: Basic` header instead.
- Inbound JWT validation still belongs on the *route* (`jwtAuth` / MCP auth). Exchange only runs after the gateway has accepted the user.

This is the missing piece after [enterprise MCP SSO with Entra](/blog/2026-01-26-enterprise-mcp-sso/): SSO gets the user *into* the gateway; OBO gets the user *out* to Graph (or any Entra-protected API / MCP server) without re-prompting login.

## Kubernetes: same knobs as a policy

On Kubernetes the same exchange attaches via `AgentgatewayPolicy` on a Service or Backend:

```yaml
apiVersion: agentgateway.dev/v1alpha1
kind: AgentgatewayPolicy
metadata:
  name: okta-token-exchange
spec:
  targetRefs:
  - group: ""
    kind: Service
    name: my-backend
  backend:
    auth:
      oauthTokenExchange:
        tokenEndpoint:
          group: agentgateway.dev
          kind: AgentgatewayBackend
          name: okta-token-endpoint
          port: 443
          path: /oauth2/default/v1/token
        clientAuth:
          clientId: "<okta-client-id>"
          secretRef:
            name: okta-oauth-client
        scopes:
        - "<scope>"
```

Token endpoints are backend references (not raw URLs), so TLS, DNS, and ReferenceGrant rules stay consistent with the rest of the data plane. Client secrets come from Kubernetes Secrets; `privateKeyJwt` is available when your AS (Okta, etc.) requires signed client assertions.

## Beyond single-leg exchange

If every MCP tool call just reused the inbound enterprise JWT, every upstream would see a token that was never minted for it. If every agent SDK keeps its own token vault, you get N credential stores and zero consistent audit which is exactly the OpenClaw-style leak surface from the earlier in this post. Gateway-side exchange keeps secrets out of the agent, preserves user identity (and optional `actorToken` for agent-on-behalf-of-user), and caches so agent loops don't hammer the token endpoint.

These single-leg grants are also the building blocks for Cross App Access / ID-JAG (a two-leg composition of token exchange and JWT-bearer). See the [`traffic-cross-app-access`](https://github.com/agentgateway/agentgateway/tree/main/examples/traffic-cross-app-access) examples if you want to explore that path. Will cover that in depth in future blogs. 

## Try it

- Standalone examples: [RFC 8693](https://github.com/agentgateway/agentgateway/tree/main/examples/traffic-token-exchange/oauth-rfc8693) · [JWT bearer + Entra OBO shape](https://github.com/agentgateway/agentgateway/tree/main/examples/traffic-token-exchange/jwt-authz-grant)
- Backend auth docs: [standalone backend authentication](https://agentgateway.dev/docs/standalone/main/configuration/security/backend-authn/)
- Related reading: [Enterprise MCP SSO with Entra](/blog/2026-01-26-enterprise-mcp-sso/) · [PR #2189](https://github.com/agentgateway/agentgateway/pull/2189) (data plane) · [PR #2458](https://github.com/agentgateway/agentgateway/pull/2458) (Kubernetes controller)

* Explore the [docs](https://agentgateway.dev/docs/) and [get started](https://agentgateway.dev/#getting-started) today.
* Star and contribute on [GitHub](https://github.com/agentgateway/agentgateway).
* Join the conversation on [Discord](https://discord.gg/y9efgEmppm).
* Attend our weekly [community meetings](https://github.com/agentgateway/agentgateway?tab=readme-ov-file#community-meetings).
