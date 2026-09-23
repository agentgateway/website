The following table describes the most common `oauthTokenExchange` fields. For the full set of fields, see the [configuration reference]({{< link-hextra path="/reference/configuration/schema/#mcp.policies.backendAuth.oauthTokenExchange" >}}).

| Field | Description |
| -- | -- |
| `host`, `policies` | The token endpoint, referenced as a backend. A `host` port of `443` automatically enables backend TLS. |
| `path` | Path of the token endpoint on the backend. Must start with `/`. Defaults to `/`. |
| `grantType` | `tokenExchange` (default, RFC 8693) or `jwtBearer` (RFC 7523). |
| `clientAuth` | Client authentication for the token endpoint: `clientSecretBasic` (default), `clientSecretPost`, or `privateKeyJwt`. Omit the field and agentgateway sends no client authentication. See [Authenticate the gateway to the token endpoint](#authenticate-the-gateway-to-the-token-endpoint). |
| `audiences`, `scopes`, `resources` | The `audience`, `scope`, and `resource` parameters sent to the token endpoint. `resources` are [RFC 8707](https://datatracker.ietf.org/doc/html/rfc8707) resource indicators. |
| `subjectToken` | Where to read the incoming credential and its token type. Defaults to the `Authorization: Bearer` header with token type `access_token`. |
| `actorToken` | Optional RFC 8693 delegation actor token (`tokenExchange` grant only). Has no default source. |
| `authorizationLocation` | Where to place the exchanged token in the backend request. Defaults to the `Authorization` header with a `Bearer ` prefix. |
| `additionalParams` | Extra form parameters appended to the token request. Values are CEL expressions. |
| `cache` | In-memory token cache. Defaults to 8192 entries with a 300-second TTL when the response omits `expires_in`. Set `maxEntries: 0` to disable. |
