| Error from Keycloak | Cause |
| -- | -- |
| `access_denied`: Client is not within the token audience | The `aud` claim of the incoming token does not include the gateway's client. Add an audience mapper for `agentgateway` to the client that issues the token. Keycloak returns `403`, so the gateway returns `500` with `backend authentication failed: token exchange returned status 403 Forbidden`. |
| `invalid_request`: Standard token exchange is not enabled for the requested client | The client in `clientAuth` does not have **Standard Token Exchange** turned on, or `clientAuth` names a different client than you configured. |
| `invalid_request`: Requested audience not available: `<client>` | The gateway's client cannot get the requested audience in its own tokens. Add an audience mapper for the backend client to a default client scope of the gateway's client. |
| `invalid_client`: Audience not found | A value in `audiences` is not a client ID in the realm. |
| `invalid_scope`: Invalid scopes: `<scope>` | A value in `scopes` is not a default or optional client scope of the gateway's client. |
| `invalid_request`: Invalid token | Keycloak rejected the incoming token: it expired, comes from another realm, or its `iss` claim does not match the issuer of the token endpoint as the gateway reaches it. The Keycloak log shows `subject_token validation failure`. |
| `invalid_request`: Parameter 'subject_token' supports access tokens only | `subjectToken.tokenType` is set to a JWT or ID token type. Remove the field to send the default, the access token type. |
| `invalid_request`: requested_token_type unsupported | `requestedTokenType` is set to the JWT type. Remove the field, or request an access token or an ID token. |
| `unauthorized_client`: Invalid client or Invalid client credentials | The client secret does not match the gateway's client. Keycloak returns `401`, so the gateway returns `500` with `backend authentication failed`. |
