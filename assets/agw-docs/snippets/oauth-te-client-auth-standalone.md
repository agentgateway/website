The `clientAuth` field decides how agentgateway identifies itself to the token endpoint. Set `method` to one of three values. Omit `clientAuth` entirely and agentgateway sends no client authentication fields, which suits a public client or a token endpoint that authenticates by other means.

{{< tabs >}}
{{% tab name="clientSecretBasic" %}}
Send the client ID and secret in the HTTP Basic `Authorization` header ([RFC 6749 §2.3.1](https://datatracker.ietf.org/doc/html/rfc6749#section-2.3.1)). This is the default method, and the one most authorization servers expect.

```yaml
clientAuth:
  method: clientSecretBasic
  clientId: $CLIENT_ID
  clientSecret: $CLIENT_SECRET
```
{{% /tab %}}
{{% tab name="clientSecretPost" %}}
Send the client ID and secret in the form body of the request. Some servers such as Microsoft Entra's on-behalf-of flow accept only this method.

```yaml
clientAuth:
  method: clientSecretPost
  clientId: $CLIENT_ID
  clientSecret: $CLIENT_SECRET
```
{{% /tab %}}
{{% tab name="privateKeyJwt" %}}
Send a signed client assertion instead of a shared secret ([RFC 7523](https://datatracker.ietf.org/doc/html/rfc7523)). Agentgateway signs a short-lived JWT with your private key on each token request, so no secret is stored in the configuration or transmitted to the authorization server.

```yaml
clientAuth:
  method: privateKeyJwt
  clientId: $CLIENT_ID
  signingKey:
    file: /path/to/client-assertion-key.pem
  alg: ES256
  kid: my-client-key
  assertionAudience: https://idp.example.com/oauth2/v1/token
```
{{% /tab %}}
{{< /tabs >}}

### Sign the client assertion with a private key

Use `privateKeyJwt` when the authorization server registers your client with a public key rather than a secret. Register the matching public key or certificate with the authorization server first, then point the `signingKey` field at the private key. This method is often required for a confidential client that must not hold a shared secret. Servers such as Okta and Microsoft Entra both support this method.

{{< reuse "agw-docs/snippets/review-table.md" >}}

| Field | Description |
| -- | -- |
| `clientId` | Required client ID that identifies agentgateway at the authorization server. |
| `signingKey` | Required PEM-encoded RSA or EC private key, either the PEM text or `{file: <path>}`. |
| `assertionAudience` | Required `aud` claim of the assertion. Most servers require the URL of the token endpoint itself. |
| `alg` | JWS signing algorithm: `RS256` (default), `RS384`, `RS512`, `PS256`, `ES256`, or `ES384`. The algorithm must match the key family. The `RS` and `PS` algorithms need an RSA key, and the `ES` algorithms need an EC key. |
| `kid` | Optional `kid` header that agentgateway stamps on the assertion. Set it when the authorization server registers more than one key for the client. |
| `certificate` | Optional PEM-encoded X.509 certificate chain, leaf first. Set it for a server that validates the assertion against a certificate rather than a bare key. |
| `certificateHeader` | JWS certificate header that agentgateway emits from `certificate`. Required when `certificate` is set. |

{{< doc-test paths="client-auth" >}}
# WHAT THIS TEST VALIDATES:
#   * All three clientAuth methods from the tabs above are accepted as complete standalone configs,
#     and privateKeyJwt is accepted with a real EC signing key.
#   * privateKeyJwt requires assertionAudience.
#   * The method names really are camelCase here: the PascalCase spelling that the Kubernetes CRDs
#     use is rejected, which is what the first bullet below claims.
# WHAT THIS TEST DOES NOT VALIDATE (and why):
#   * That an authorization server accepts the assertion -- external dependency: needs a real IdP
#     with the matching public key registered for the client. The docker-compose walkthroughs
#     earlier on this page cover a live exchange with clientSecretBasic instead.
#   * The certificate and certificateHeader fields -- external dependency: the failure mode the
#     page describes (a mismatch is logged and does not stop loading) is only observable at a token
#     endpoint that validates the assertion.
{{< reuse "agw-docs/snippets/install-agentgateway-binary.md" >}}
export CLIENT_ID="${CLIENT_ID:-my-gateway}"
export CLIENT_SECRET="${CLIENT_SECRET:-not-a-real-secret}"
openssl genpkey -algorithm EC -pkeyopt ec_paramgen_curve:P-256 -out client-assertion-key.pem
{{< /doc-test >}}

{{< doc-test paths="client-auth" >}}
# The tabs above show the clientAuth block only, so wrap each one in the config it belongs to.
client_auth_case() {
  local name="$1" expect="$2"
  { cat <<'EOF'
# yaml-language-server: $schema=https://agentgateway.dev/schema/config
gateways:
  default:
    port: 3000
routes:
- backends:
  - host: backend.example.com:443
    policies:
      backendAuth:
        oauthTokenExchange:
          host: idp.example.com:443
          path: /oauth2/v1/token
          audiences:
          - api://my-backend
          clientAuth:
EOF
    sed 's/^/            /'
  } > "config-client-auth-$name.yaml"
  if agentgateway -f "config-client-auth-$name.yaml" --validate-only > "client-auth-$name.log" 2>&1; then
    [ "$expect" = ok ] || { echo "FAIL: $name was accepted but should be rejected"; exit 1; }
    echo "ok       $name"
  else
    [ "$expect" = fail ] || { echo "FAIL: $name was rejected"; cat "client-auth-$name.log"; exit 1; }
    echo "rejected $name (as expected)"
  fi
}

client_auth_case secret-basic ok <<'EOF'
method: clientSecretBasic
clientId: $CLIENT_ID
clientSecret: $CLIENT_SECRET
EOF

client_auth_case secret-post ok <<'EOF'
method: clientSecretPost
clientId: $CLIENT_ID
clientSecret: $CLIENT_SECRET
EOF

client_auth_case private-key-jwt ok <<'EOF'
method: privateKeyJwt
clientId: $CLIENT_ID
signingKey:
  file: client-assertion-key.pem
alg: ES256
kid: my-client-key
assertionAudience: https://idp.example.com/oauth2/v1/token
EOF

# assertionAudience is required.
client_auth_case private-key-jwt-no-audience fail <<'EOF'
method: privateKeyJwt
clientId: $CLIENT_ID
signingKey:
  file: client-assertion-key.pem
EOF

# The Kubernetes spelling must not be accepted here.
client_auth_case pascal-method fail <<'EOF'
method: PrivateKeyJwt
clientId: $CLIENT_ID
signingKey:
  file: client-assertion-key.pem
assertionAudience: https://idp.example.com/oauth2/v1/token
EOF

echo "clientAuth methods verified"
{{< /doc-test >}}

> [!NOTE]
> The `privateKeyJwt` method is not the same as the `jwtSign` backend authentication method. Both sign a JWT with your private key, and they share the implementation, but `privateKeyJwt` authenticates agentgateway to the token endpoint, while [`jwtSign`]({{< link-hextra path="/documentation/configuration/security/backend-authn/jwt-sign/" >}}) sends a signed JWT to the backend itself.

Two details are worth knowing before you rely on the method.

* **The method names are camelCase here.** The Kubernetes custom resources spell the same values in PascalCase, as `ClientSecretBasic`, `ClientSecretPost`, and `PrivateKeyJwt`. Agentgateway rejects the PascalCase spelling.
* **The leaf public key of `certificate` must match `signingKey`.** A mismatch is logged and does not stop the configuration from loading, so the failure appears as a rejected assertion at the token endpoint rather than as a startup error.

