Backend authentication is how the gateway proves its own identity to an upstream service. Client authentication is the opposite direction: how a client proves its identity to the gateway. The two are separate settings, and most routes need both.

A request therefore carries up to two credentials at different points in its life. The client sends one to the gateway, and the gateway sends a different one to the backend. What connects them is that the client credential is often what the gateway uses to get the backend credential.

## Choose a method

Start from what the upstream expects, not from what the client sends.

| The upstream expects | Use | Where the credential comes from |
| -- | -- | -- |
| A fixed API key or token | **Static key** | A value that you configure, or a Secret or file that you control |
| The credential that the client already sent | **Passthrough** | The incoming request |
| A token issued by AWS, Azure, or Google Cloud | **Cloud provider credentials** | The cloud provider, in exchange for the gateway's own identity |
| A GitHub Copilot token | **Cloud provider credentials** | The environment of the gateway process |
| A JWT signed by your private key, fresh on every request | **Signed JWT** | The gateway signs one per request from a key that you supply |
| A narrower token, derived from the client's credential at one authorization server | **OAuth token exchange** | An authorization server, in exchange for the client credential |
| A token from an authorization server that did not authenticate the user | **Cross App Access** | Two authorization servers, across a trust boundary |

The families in more detail:

* **Static key.** The simplest case, and the right one whenever the backend issues you a long-lived credential. Prefer a Secret or a file over an inline value, so that the credential is not stored in the configuration.
* **Passthrough.** Sends the client credential on to the backend unchanged. Use it when the backend validates the same credential that the gateway validated, such as two services that trust the same issuer.
* **Cloud provider credentials.** The gateway authenticates as itself, using the identity of the workload it runs as. This is the method to reach for on a managed cluster, because it needs no stored secret: the cloud supplies the identity and the gateway exchanges it for a token. Each provider also accepts an explicit credential when the ambient identity is not the one you want.
* **Signed JWT.** For an upstream that rejects durable credentials outright and wants a fresh keypair-signed JWT on each call. The Snowflake SQL API is the common example.
* **OAuth token exchange.** Narrows or re-scopes the client's credential. Use it when the client identity should reach the backend, but not the client's original token, and when one authorization server can issue the new token.
* **Cross App Access.** Token exchange across a trust boundary, using the OAuth Identity Assertion Authorization Grant. The identity provider that authenticated the user and the authorization server that guards the resource are different parties, so the gateway performs two exchanges and holds a client registration at each. For a single-leg exchange, use OAuth token exchange instead.

Two methods are not available everywhere. GitHub Copilot works in the standalone binary only, and Signed JWT arrived in 1.5.x. For the full matrix, see [Method availability](#method-availability-and-field-differences).

## Combine methods

A policy sets **at most one** of the methods above. They are alternatives, not layers, and configuring two is rejected rather than applied in some order.

One mechanism is additive. A `credentials` list injects extra credentials, each to its own location, and it works either on its own or alongside a primary method. Use it for an upstream that wants two credentials on the same request, such as a bearer token and a subscription key.

## Backend authentication and client authentication

The two directions interact in one way that is easy to miss: **a client authentication policy removes the credential it validates.**

A JWT, API key, or basic auth policy reads the client credential from a location, validates it, and then strips it from the request so the backend never sees it. That is usually what you want. It also means the credential is gone by the time backend authentication runs, which matters for two of the methods:

* **Passthrough puts it back.** The method exists for exactly this reason. On a route with no client authentication policy, passthrough does nothing, because nothing removed the credential in the first place.
* **Token exchange and Cross App Access read the request.** Both take the subject token from a location on the incoming request, defaulting to the `Authorization` header with a `Bearer ` prefix. If a client authentication policy on the same route has already stripped that header, the exchange finds nothing to exchange.

> [!WARNING]
> Do not point a client authentication policy and a token exchange at the same location. The JWT policy validates the token and strips it, the exchange then has no subject token, and the request fails with a `400` and a body of `invalid request`. The policy status looks healthy, and the reason appears only in the gateway log at debug level.
>
> ```
> debug http::auth::oauth oauth token exchange subject token missing source=Header { name: "authorization", prefix: Some("Bearer ") }
> ```
>
> Move one of the two. Either read the client token from a different header in the client authentication policy, or point `subjectToken` at the location where the credential actually is.

The other methods do not read the client credential at all, so they compose with any client authentication policy without further thought.

## Backend authentication is not authorization

Backend authentication decides **what credential the gateway sends**. It does not decide **who is allowed through**. A route that attaches a static key to every backend request still forwards every request that reaches it.

To decide which callers are allowed, and which tools or models they may reach, use an authorization policy alongside backend authentication. The two are complementary: authorization runs on the way in, backend authentication on the way out.
