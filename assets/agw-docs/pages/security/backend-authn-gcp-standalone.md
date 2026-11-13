## Configuration examples

To connect to a Google Cloud service, use `gcp`. Agentgateway reads [Application Default Credentials](https://docs.cloud.google.com/docs/authentication/application-default-credentials) from the environment and attaches a token to each request.

Each example shows the `backendAuth` policy only. Attach it to a backend under `backends[].policies`, or to a route under `routes[].policies`.

```yaml
backendAuth:
  gcp: {}
```

Set the `type` field to choose the kind of token. Most Google services take an access token, and Cloud Run takes an ID token.

```yaml
backendAuth:
  gcp:
    type: accessToken
```

```yaml
backendAuth:
  gcp:
    type: idToken
    audience: "https://my-cloudrun-service-xyz.run.app"
```

> [!IMPORTANT]
> The token type is camelCase in the standalone binary: `accessToken` and `idToken`. The Kubernetes custom resources spell the same values in PascalCase, as `AccessToken` and `IdToken`. Agentgateway rejects the PascalCase spelling rather than falling back to a default.

{{< reuse "agw-docs/snippets/review-table.md" >}}

| Field | Description |
| -- | -- |
| `type` | Kind of token to fetch: `accessToken` for most Google services, or `idToken` for Cloud Run. Omit the field and agentgateway fetches an access token. |
| `audience` | The `aud` claim of the ID token. Valid only with `idToken`. Omit the field and agentgateway uses the hostname of the backend. |
| `credential` | ADC-compatible Google credential JSON, either inline or as `{file: <path>}`. Omit the field to use the ambient credentials of the environment. |

By default, agentgateway resolves credentials from the environment. It reads the path in the `GOOGLE_APPLICATION_CREDENTIALS` environment variable, and falls back to `$HOME/.config/gcloud/application_default_credentials.json`. On Windows the fallback path is `%APPDATA%/gcloud/application_default_credentials.json`. Set the `credential` field to supply the credential JSON directly instead.

Not every credential type works with both token types.

| Credential JSON `type` | `accessToken` | `idToken` |
| -- | -- | -- |
| `authorized_user` | Yes | Yes |
| `service_account` | Yes | Yes |
| `impersonated_service_account` | Yes | Yes |
| `external_account` | Yes | No |
| `gdch_service_account` | No | Yes, and `audience` is required |

> [!NOTE]
> Agentgateway parses the `credential` JSON when it loads the configuration, not on the first request. A malformed or incomplete credential therefore fails `--validate-only`, which is where you want to find out about it.
