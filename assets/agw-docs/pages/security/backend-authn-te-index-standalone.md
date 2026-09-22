Exchange the credential that a client sends to the gateway for a different, backend-specific credential at an OAuth authorization server.

## About

Instead of attaching a fixed credential to backend requests, the `oauthTokenExchange` backend authentication method exchanges the incoming request's credential for a new, backend-specific token at an OAuth authorization server, then forwards that token to the backend. Token exchange is useful when a client authenticates to the gateway with one identity, but the backend requires a different, narrowly scoped token.

Because the gateway performs the exchange, backend credentials are injected by the infrastructure and are never exposed to the AI models or agents that send requests through the gateway. The user's identity is preserved end-to-end, and the exchange can optionally carry an agent identity acting on behalf of the user (see `actorToken`), which keeps a consistent identity chain for auditing. This is a single-leg exchange, in which the gateway calls one authorization server.

By default, the proxy reads the incoming credential from the `Authorization: Bearer` header, exchanges it at the configured token endpoint, and attaches the returned token to the backend request in the `Authorization: Bearer` header.

Validation of the incoming credential is the job of a route-level policy, such as [JWT authentication]({{< link-hextra path="/documentation/configuration/security/jwt-authn/" >}}) or [MCP authentication]({{< link-hextra path="/documentation/configuration/security/mcp-authn/" >}}), not the exchange itself. The exchange only reads the credential and presents it to the authorization server.

Authorization servers that implement these grants include Keycloak, Microsoft Entra ID, Okta, Auth0, and ZITADEL.

## Choose an exchange

Two backend authentication methods perform an exchange. Which one you need depends on how many authorization servers are involved.

| Method | Authorization servers | Use it when |
| -- | -- | -- |
| `oauthTokenExchange` | One | One server can issue the backend token from the client's credential. |
| `crossAppAccess` | Two, across a trust boundary | The identity provider that authenticated the user and the authorization server that guards the resource are different parties. |

The `oauthTokenExchange` method supports two grants, and you choose between them with the `grantType` field.

| Grant | `grantType` | Standard | The incoming credential is sent as | Guide |
| -- | -- | -- | -- | -- |
| Token exchange (default) | `tokenExchange` | [RFC 8693](https://datatracker.ietf.org/doc/html/rfc8693) | `subject_token` | [Standard token exchange]({{< link-hextra path="/documentation/configuration/security/backend-authn/token-exchange/standard/" >}}) |
| JWT bearer | `jwtBearer` | [RFC 7523](https://datatracker.ietf.org/doc/html/rfc7523) | `assertion` | [JWT bearer grant]({{< link-hextra path="/documentation/configuration/security/backend-authn/token-exchange/jwt-bearer/" >}}) |

Some identity providers have vendor-specific variants of a grant. Microsoft Entra's on-behalf-of flow is a variant of the JWT bearer grant, and the [JWT bearer guide]({{< link-hextra path="/documentation/configuration/security/backend-authn/token-exchange/jwt-bearer/" >}}) covers it.

## Configuration

The token endpoint is configured as a backend reference: a `host` in `host:port` form and, optionally, connection `policies` such as `backendTLS`. A `host` port of `443` automatically enables backend TLS.

{{< reuse "agw-docs/snippets/oauth-te-fields-standalone.md" >}}

## Guides
