---
title: Cross App Access (ID-JAG)
weight: 20
description: Call a downstream API as the authenticated end user with the OAuth Identity Assertion Authorization Grant.
---

Attaches to: {{< badge content="Backend" path="/configuration/backends/" >}}

## About

The `crossAppAccess` backend authentication method implements the [OAuth Identity Assertion Authorization Grant](https://datatracker.ietf.org/doc/draft-ietf-oauth-identity-assertion-authz-grant/), also called "ID-JAG" or "Cross App Access". With this method, agentgateway calls a downstream API *as the authenticated end user*, without requiring the user to interactively log in to that downstream app. This pattern is common in agentic scenarios where an agent calls other apps' APIs on behalf of the user.

The gateway acts as a confidential OAuth client and performs a two-leg exchange on each backend call:

1. **Authenticate the user.** The inbound request carries the user's OIDC ID token, validated by the [`jwtAuth` policy]({{< link-hextra path="/configuration/security/jwt-authn/" >}}). The validated token is the subject of the exchange. The `jwtAuth` policy must validate an OIDC ID token, not an arbitrary access token, because the identity provider expects an ID token as the subject.
2. **Token exchange.** The gateway calls the user's identity provider (IdP) authorization server with an [RFC 8693](https://datatracker.ietf.org/doc/html/rfc8693) token exchange and receives an ID-JAG assertion that is bound to the resource authorization server.
3. **JWT-bearer grant.** The gateway presents the ID-JAG to the resource's authorization server with an [RFC 7523](https://datatracker.ietf.org/doc/html/rfc7523) JWT-bearer grant and receives a Bearer access token that is scoped to the downstream API.
4. **Attach and cache.** The Bearer token is added as `Authorization: Bearer <token>` to the upstream request and cached until shortly before it expires.

## Configuration

The following configuration from the [`traffic-cross-app-access` example](https://github.com/agentgateway/agentgateway/tree/main/examples/traffic-cross-app-access) in the agentgateway repository configures the `crossAppAccess` method next to the `jwtAuth` policy that authenticates the user. The gateway requires two separate client registrations, one at the IdP and one at the resource authorization server, each with its own client ID and credentials.

{{% github-yaml url="https://agentgateway.dev/examples/traffic-cross-app-access/xaa-dev/gateway.yaml" %}}

| Setting | Description |
| -- | -- |
| `identityProvider` | The user's IdP authorization server token endpoint. Agentgateway sends the authenticated ID token as the RFC 8693 `subject_token`. Reference the endpoint as a `host`, `service`, or `backend`, and set the `tokenEndpointPath`, which defaults to `/`. |
| `resourceAuthorizationServer` | The resource authorization server token endpoint. This leg uses the RFC 7523 JWT-bearer grant, with the ID-JAG from the IdP leg sent as the assertion. This is a separate client registration from the IdP one. |
| `clientAuth` | Client authentication for each token endpoint. Supported methods are `clientSecretBasic`, `clientSecretPost`, and `privateKeyJwt`. |
| `audience` | Required identifier of the resource authorization server. The issued ID-JAG is bound to this value. |
| `resources` | Optional protected resource or API identifiers ([RFC 8707](https://datatracker.ietf.org/doc/html/rfc8707)). Configure these explicitly when the authorization server expects them. |
| `scopes` | Optional scopes to request. The authorization server might grant a subset. |
| `cache` | Optional token cache configuration. Defaults to an in-memory cache with 8192 entries. Set `cache.defaultTtl` as a fallback for when the token response omits `expires_in` (defaults to `300s`), and `cache.maxEntries: 0` to disable caching. The cache duration is capped by the subject token's JWT `exp` claim when present. |

## Private key JWT client authentication

Enterprise IdPs such as Okta commonly require the `privateKeyJwt` client authentication method, in which the gateway authenticates with a signed JWT assertion instead of a client secret. Because token endpoints are configured as backend references rather than raw URLs, `privateKeyJwt` requires an explicit `assertionAudience`:

```yaml
clientAuth:
  clientId: gateway-at-chat
  method: privateKeyJwt
  signingKey:
    file: /path/to/signing-key.pem
  alg: RS256  # one of RS256/RS384/RS512/ES256/ES384
  kid: my-signing-key  # optional `kid` header
  assertionAudience: https://chat.example.com/oauth2/token
```

## Try it out

The [`traffic-cross-app-access` example](https://github.com/agentgateway/agentgateway/tree/main/examples/traffic-cross-app-access) includes ready-to-run demos against the [xaa.dev](https://app.xaa.dev/) hosted clients, a local Keycloak stack, and an Okta and Auth0 setup. Follow the example README for step-by-step instructions.

## Limitations

{{< callout type="info" >}}
The following parts of the Identity Assertion Authorization Grant draft are not yet supported: DPoP sender-constrained tokens (RFC 9449), `.well-known` endpoint discovery (RFC 8414, endpoints must be configured explicitly), and SAML or refresh-token subject types (only OIDC ID tokens are used as the subject).
{{< /callout >}}

## What's next

- Exchange the incoming credential for a per-backend token with [OAuth token exchange]({{< link-hextra path="/configuration/security/backend-authn/oauth-token-exchange/" >}}).
- Validate incoming JWTs with the [JWT authentication]({{< link-hextra path="/configuration/security/jwt-authn/" >}}) policy.
