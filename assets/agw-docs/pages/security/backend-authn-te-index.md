Exchange the credential that a client sends to the gateway for a different, backend-specific credential at an OAuth authorization server.

## About

Instead of attaching a fixed credential to backend requests, token exchange sends the incoming request's credential to an OAuth authorization server, receives a new token in return, and forwards that token to the backend. Token exchange is useful when a client authenticates to the gateway with one identity, but the backend requires a different, narrowly scoped token.

Because the gateway performs the exchange, backend credentials are injected by the infrastructure and are never exposed to the AI models or agents that send requests through the gateway. The user's identity is preserved end-to-end, and the exchange can optionally carry an agent identity acting on behalf of the user, which keeps a consistent identity chain for auditing.

Validation of the incoming credential is the job of a route-level policy, such as [JWT authentication]({{< link-hextra path="/documentation/security/jwt/" >}}), not the exchange itself. The exchange only reads the credential and presents it to the authorization server.

## Choose an exchange

Two backend authentication methods perform an exchange. Which one you need depends on how many authorization servers are involved.

| Method | Authorization servers | Use it when |
| -- | -- | -- |
| `oauthTokenExchange` | One | One server can issue the backend token from the client's credential. |
| `crossAppAccess` | Two, across a trust boundary | The identity provider that authenticated the user and the authorization server that guards the resource are different parties. |

The `oauthTokenExchange` method supports two grants, and you choose between them with the `grantType` field.

| Grant | `grantType` | Standard | The incoming credential is sent as | Guide |
| -- | -- | -- | -- | -- |
| Token exchange (default) | `TokenExchange` | [RFC 8693](https://datatracker.ietf.org/doc/html/rfc8693) | `subject_token` | [Standard token exchange]({{< link-hextra path="/documentation/security/backend-authn/token-exchange/standard/" >}}) |
| JWT bearer | `JwtBearer` | [RFC 7523](https://datatracker.ietf.org/doc/html/rfc7523) | `assertion` | [JWT bearer grant]({{< link-hextra path="/documentation/security/backend-authn/token-exchange/jwt-bearer/" >}}) |

Some identity providers have vendor-specific variants of a grant. Microsoft Entra's on-behalf-of flow is a variant of the JWT bearer grant, and the [JWT bearer guide]({{< link-hextra path="/documentation/security/backend-authn/token-exchange/jwt-bearer/" >}}) covers it.

## Configuration

The token endpoint (authorization server) is configured as its own {{< reuse "agw-docs/snippets/backend.md" >}}, which the {{< reuse "agw-docs/snippets/policy.md" >}} then references through `backendRef`. The gateway's OAuth client secret is read from a Kubernetes Secret through `clientAuth.secretRef`. The policy attaches to the backend workload with `targetRefs`, so the exchange runs whenever the gateway forwards a request to that backend.

{{< reuse "agw-docs/snippets/oauth-token-exchange-fields.md" >}}

## Guides
