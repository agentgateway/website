{{< reuse "agw-docs/snippets/review-table.md" >}} For more information, see the [API docs]({{< link-hextra path="/reference/api/#oauthtokenexchange" >}}).

| Field | Description |
| -- | -- |
| `backendRef` | Reference to the {{< reuse "agw-docs/snippets/backend.md" >}} for the token endpoint. Mutually exclusive with `url`. Set exactly one of the two. |
| `url` | The full address of the token endpoint, including the path. Use this field instead of `backendRef` to point at the authorization server directly, without creating an intermediate Kubernetes object. Mutually exclusive with `backendRef`. Do not set `path` when you use `url`. |
| `path` | Path of the token endpoint on the backend. Must start with `/`. Defaults to `/`. |
| `grantType` | `TokenExchange` (default, RFC 8693) or `JwtBearer` (RFC 7523). |
| `clientAuth` | Client authentication for the token endpoint. `method` is `ClientSecretBasic` (default), `ClientSecretPost`, or `PrivateKeyJwt`. Use `secretRef` to read the client secret from a Kubernetes Secret. |
| `audiences`, `scopes`, `resources` | The `audience`, `scope`, and `resource` parameters sent to the token endpoint. `resources` are [RFC 8707](https://datatracker.ietf.org/doc/html/rfc8707) resource indicators. |
| `subjectToken.source` | Where the gateway reads the incoming token from. Set exactly one of `header`, `queryParameter`, `cookie`, or `expression`, where `expression` is a CEL expression that reads the token from the request, such as a claim of a validated JWT. Defaults to the `Authorization` header with the `Bearer` prefix. |
| `subjectToken.tokenType` | The type that the gateway reports for that token. Use a built-in name such as `AccessToken` (the default), `Jwt`, or `IdToken`, or a custom absolute URI. See [Token types]({{< link-hextra path="/documentation/security/backend-authn/token-exchange/standard/#token-types" >}}). |
| `actorToken` | Optional RFC 8693 delegation actor token (`TokenExchange` grant only). Takes the same `tokenType` values as `subjectToken`. |
| `requestedTokenType` | Optional token type to request, limited to `AccessToken`, `Jwt`, or `IdToken`, and valid only with the `TokenExchange` grant type. The response must return the type that you request. See [Request a token type]({{< link-hextra path="/documentation/security/backend-authn/token-exchange/standard/#requested-token-type" >}}). |
| `location` | Where to place the exchanged token in the backend request. Defaults to the `Authorization` header. |
| `additionalParams` | Extra form parameters appended to the token request. Values are CEL expressions. |
| `cache` | In-memory token cache. Defaults to 8192 entries. Set `inMemory.maxEntries: 0` to disable. |
