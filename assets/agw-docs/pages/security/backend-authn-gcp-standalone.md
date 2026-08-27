Authenticate to a Google Cloud service from agentgateway with a Google-issued token.

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

{{< doc-test paths="backend-authn-gcp" >}}
# WHAT THIS TEST VALIDATES:
#   * Every gcp fragment above is accepted once wrapped in the gateways/routes
#     scaffolding that the page tells the reader to add.
#   * The token type really is camelCase. The PascalCase spelling that the
#     Kubernetes custom resources use is rejected here, which is what the
#     IMPORTANT note claims.
#   * audience belongs to idToken only.
#   * A credential JSON that is malformed fails at load time, not on the first
#     request, which is what the closing note claims.
# WHAT THIS TEST DOES NOT VALIDATE (and why):
#   * That any credential authenticates to Google -- external dependency: needs a
#     real project, service account, and API to call.
#   * The Application Default Credentials search order -- external dependency:
#     exercising a rung means supplying the credential it looks for, on the host
#     type it looks on.
#   * The per-token-type credential support matrix -- external dependency: each
#     row needs a real credential of that type to get past the parse.
{{< reuse "agw-docs/snippets/install-agentgateway-binary.md" >}}
cat <<'JSON' > gcp-credentials.json
{
  "type": "authorized_user",
  "client_id": "1234.apps.googleusercontent.com",
  "client_secret": "notarealsecret",
  "refresh_token": "notarealtoken"
}
JSON
{{< /doc-test >}}

{{< doc-test paths="backend-authn-gcp" >}}
gcp_case() {
  local name="$1" expect="$2"
  { cat <<'EOF'
# yaml-language-server: $schema=https://agentgateway.dev/schema/config
gateways:
  default:
    port: 3000
routes:
- backends:
  - host: my-service-xyz.run.app:443
    policies:
      backendAuth:
EOF
    sed 's/^/        /'
  } > "config-gcp-$name.yaml"
  if agentgateway -f "config-gcp-$name.yaml" --validate-only > "gcp-$name.log" 2>&1; then
    [ "$expect" = ok ] || { echo "FAIL: $name was accepted but should be rejected"; exit 1; }
    echo "ok       $name"
  else
    [ "$expect" = fail ] || { echo "FAIL: $name was rejected"; cat "gcp-$name.log"; exit 1; }
    echo "rejected $name (as expected)"
  fi
}

gcp_case implicit ok <<'EOF'
gcp: {}
EOF

gcp_case access-token ok <<'EOF'
gcp:
  type: accessToken
EOF

gcp_case id-token ok <<'EOF'
gcp:
  type: idToken
  audience: "https://my-cloudrun-service-xyz.run.app"
EOF

gcp_case explicit-credential ok <<'EOF'
gcp:
  type: accessToken
  credential:
    file: gcp-credentials.json
EOF

# The Kubernetes spelling must not be accepted here.
gcp_case pascal-access-token fail <<'EOF'
gcp:
  type: AccessToken
EOF

gcp_case pascal-id-token fail <<'EOF'
gcp:
  type: IdToken
  audience: "https://my-cloudrun-service-xyz.run.app"
EOF

gcp_case audience-on-access-token fail <<'EOF'
gcp:
  type: accessToken
  audience: "https://my-cloudrun-service-xyz.run.app"
EOF

# A credential that cannot be parsed fails when the configuration loads.
echo 'not json' > bad-credentials.json
gcp_case malformed-credential fail <<'EOF'
gcp:
  type: accessToken
  credential:
    file: bad-credentials.json
EOF

echo "gcp standalone backend authentication verified"
{{< /doc-test >}}
