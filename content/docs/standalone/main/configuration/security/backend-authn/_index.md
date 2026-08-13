---
title: Backend authentication
weight: 10
description: Attach authentication tokens to outgoing backend requests.
test:
  backend-authn:
  - file: ${versionRoot}/configuration/security/backend-authn/_index.md
    path: backend-authn
---

Attaches to: {{< badge content="Backend" path="/configuration/backends/" >}}

{{< reuse "agw-docs/snippets/config-styles-note.md" >}}

{{< doc-test paths="backend-authn" >}}
{{< reuse "agw-docs/snippets/install-agentgateway-binary.md" >}}
export MY_API_KEY="${MY_API_KEY:-dummy}"
{{< /doc-test >}}

## Configuration examples

When connecting to a backend, an authentication token can be attached to each request using the backend authentication policy.

### Static keys

To attach a static key as an `Authorization` value, use `key`:

{{< tabs >}}
{{< tab name="Simplified (MCP)" >}}
```yaml
# yaml-language-server: $schema=https://agentgateway.dev/schema/config
mcp:
  port: 3000
  policies:
    backendAuth:
      key:
        value: $MY_API_KEY
  targets:
  - name: everything
    stdio:
      cmd: npx
      args: ["@modelcontextprotocol/server-everything"]
```
{{< /tab >}}
{{< tab name="Routing-based" >}}
```yaml
# yaml-language-server: $schema=https://agentgateway.dev/schema/config
gateways:
  default:
    port: 3000
routes:
- backends:
  - host: localhost:8080
    policies:
      backendAuth:
        key:
          value: $MY_API_KEY
```
{{< /tab >}}
{{< /tabs >}}

{{< doc-test paths="backend-authn" >}}
# WHAT THIS TEST VALIDATES:
#   * The static-key backendAuth example config is accepted by agentgateway in
#     both the routing-based (gateways) and simplified MCP (mcp.policies) forms.
# WHAT THIS TEST DOES NOT VALIDATE (and why):
#   * The other backendAuth snippets on this page (file path, location,
#     passthrough, gcp, aws, crossAppAccess) are field-reference fragments
#     with no `gateways:`, so they are not standalone configs and are not
#     tested here.
cat <<'EOF' > config.yaml
# yaml-language-server: $schema=https://agentgateway.dev/schema/config
gateways:
  default:
    port: 3000
routes:
- backends:
  - host: localhost:8080
    policies:
      backendAuth:
        key:
          value: $MY_API_KEY
EOF
agentgateway -f config.yaml --validate-only

cat <<'EOF' > config-mcp.yaml
# yaml-language-server: $schema=https://agentgateway.dev/schema/config
mcp:
  port: 3000
  policies:
    backendAuth:
      key:
        value: $MY_API_KEY
  targets:
  - name: everything
    stdio:
      cmd: npx
      args: ["@modelcontextprotocol/server-everything"]
EOF
agentgateway -f config-mcp.yaml --validate-only
{{< /doc-test >}}

The remaining examples on this page show only the `backendAuth` policy. Attach each one to a backend under `backends[].policies`, as shown in the complete example above.

### File path

You can also add keys via a file path.

```yaml
backendAuth:
  key:
    value:
      file: /path/to/my/key
```

### Authorization location

By default, the proxy retrieves the key from the `Authorization` header value. 

{{< tabs >}}
{{% tab name="Different header" %}}
To use a different header name, use the `location` field as shown in the following example.

```yaml
backendAuth:
  key:
    value: $MY_API_KEY
    location:
      # Send as a request header (default)
      header:
        name: authorization
        prefix: "Bearer "
```
{{% /tab %}}
{{% tab name="Query parameter" %}}
```yaml
backendAuth:
  key:
    value: $MY_API_KEY
    location:
      # Send as a query parameter
      queryParameter:
        name: api_key
```
{{% /tab %}}
{{% tab name="Cookie" %}}
```yaml
backendAuth:
  key:
    value: $MY_API_KEY
    location:
      # Send as a cookie
      cookie:
        name: api_key
```
{{% /tab %}}
{{< /tabs >}}

### Passthrough

When using any form of incoming authentication, such as [JWT]({{< link-hextra path="/configuration/security/jwt-authn/" >}}), [API key]({{< link-hextra path="/configuration/security/apikey-authn/" >}}), or [basic auth]({{< link-hextra path="/configuration/security/basic-authn/" >}}), the original credential is removed from the request by default before forwarding to the backend.
To pass the original credential through to the backend, use the `passthrough` method:

```yaml
backendAuth:
  passthrough: {}
```

The `passthrough` method also accepts a `location` field to specify where to read the credential from:

```yaml
backendAuth:
  passthrough:
    location:
      header:
        name: authorization
        prefix: "Bearer "
```

## Google credentials

Google [Application Default Credentials](https://docs.cloud.google.com/docs/authentication/application-default-credentials) can also be used, which can be useful when connecting to GCP services:

```yaml
backendAuth:
  gcp: {}
```

To request an access token (for most GCP services) or an ID token (for Cloud Run), set the `type` field:

```yaml
backendAuth:
  gcp:
    type: AccessToken
```

```yaml
backendAuth:
  gcp:
    type: IdToken
    audience: "https://my-cloudrun-service-xyz.run.app"
```

Credentials are sourced from the environment automatically (for example, via the `GOOGLE_APPLICATION_CREDENTIALS` environment variable or a metadata server).

## AWS credentials

AWS authentication can be used to sign requests to AWS services:

```yaml
backendAuth:
  aws:
    # Specify access key and session token
    # Alternatively, leaving this empty will use the standard AWS credential lookup (https://docs.aws.amazon.com/sdkref/latest/guide/access.html) based on the environment
    accessKeyId: "$AWS_ACCESS_KEY_ID"
    secretAccessKey: "$AWS_SECRET_ACCESS_KEY"
    sessionToken: "$AWS_SESSION_TOKEN"
    region: us-west-2
```

## Signed JWT

Some upstreams do not accept a durable credential at all. The Snowflake SQL API, for example, requires a JWT that is signed with the caller's private key on each call. With `jwtSign`, agentgateway mints the token itself: it loads a PEM-encoded RSA or EC private key, signs a JWT that carries the claims you configure, and writes that token to each request that it forwards to the backend. Nothing is cached, so agentgateway signs every request afresh.

```yaml
backendAuth:
  jwtSign:
    signingKey:
      file: /path/to/signing-key.pem
    alg: ES256
    kid: my-signing-key
    claims:
      iss: MYACCOUNT.MYUSER.SHA256:my-public-key-fingerprint
      sub: MYACCOUNT.MYUSER
      aud: https://myaccount.snowflakecomputing.com
    ttl: 60s
```

{{< reuse "agw-docs/snippets/review-table.md" >}}

| Field | Description |
| -- | -- |
| `signingKey` | Required PEM-encoded RSA or EC private key. Use `file` to read the key from a path, or set the field to the PEM text itself. |
| `alg` | JWS signing algorithm: `RS256` (default), `RS384`, `RS512`, `PS256`, `ES256`, or `ES384`. The algorithm must match the key family. The `RS` and `PS` algorithms need an RSA key, and the `ES` algorithms need an EC key. |
| `kid` | Optional `kid` header that agentgateway stamps on every token. Omit the field and no `kid` header is written. |
| `claims` | Optional static claims that agentgateway copies into every token, such as `iss`, `sub`, and `aud`. A value can be any JSON value, including a number or an array. |
| `ttl` | Optional token lifetime used for `exp`. Defaults to `300s`. |
| `location` | Optional location that the signed token is written to. Defaults to the `Authorization` header with a `Bearer` prefix, and takes the same shape as the `location` field shown earlier on this page. |

Only `signingKey` is required. A policy that sets nothing else signs with `RS256` and a 300-second lifetime, and writes the token to the `Authorization` header.

The signer owns the time claims. Agentgateway always sets `iat` and `exp`, and backdates `iat` by 10 seconds so that a validator whose clock trails the proxy still accepts a freshly minted token. A decoded token therefore spans the `ttl` plus 10 seconds, and never carries an `nbf` claim. Setting `iat`, `exp`, or `nbf` under `claims` is rejected when the configuration loads.

```
Error: jwtSign claim "iat" is reserved for the signer and cannot be configured
```

An `alg` that disagrees with the key family is rejected the same way, so a mismatch surfaces before the proxy serves traffic.

```
Error: failed to parse jwtSign signingKey: failed to load RSA signing key
```

{{< doc-test paths="backend-authn" >}}
# WHAT THIS TEST VALIDATES:
#   * The jwtSign backendAuth example is accepted as a complete standalone config, with the signing
#     key read from a file.
#   * The reserved-claim and alg/key-mismatch errors quoted above are the errors that the binary
#     actually emits.
openssl genpkey -algorithm EC -pkeyopt ec_paramgen_curve:P-256 -out signing-key.pem

cat <<EOF > config-jwt-sign.yaml
# yaml-language-server: \$schema=https://agentgateway.dev/schema/config
gateways:
  default:
    port: 3000
routes:
- backends:
  - host: localhost:8080
    policies:
      backendAuth:
        jwtSign:
          signingKey:
            file: $(pwd)/signing-key.pem
          alg: ES256
          kid: my-signing-key
          claims:
            iss: MYACCOUNT.MYUSER.SHA256:my-public-key-fingerprint
            sub: MYACCOUNT.MYUSER
            aud: https://myaccount.snowflakecomputing.com
          ttl: 60s
EOF
agentgateway -f config-jwt-sign.yaml --validate-only

# A reserved claim is rejected when the configuration loads.
python3 -c 'import sys; s=open("config-jwt-sign.yaml").read(); open("config-jwt-sign-reserved.yaml","w").write(s.replace("            iss:", "            iat: 12345\n            iss:"))'
if agentgateway -f config-jwt-sign-reserved.yaml --validate-only 2>/dev/null; then
  echo "FAILED: expected the reserved iat claim to be rejected"; exit 1
fi

# An alg that disagrees with the key family is rejected the same way.
sed 's/          alg: ES256/          alg: RS256/' config-jwt-sign.yaml > config-jwt-sign-mismatch.yaml
if agentgateway -f config-jwt-sign-mismatch.yaml --validate-only 2>/dev/null; then
  echo "FAILED: expected the RS256 and EC key mismatch to be rejected"; exit 1
fi
echo "jwtSign standalone configuration verified"
{{< /doc-test >}}

## Token exchange methods

Instead of attaching a fixed credential, agentgateway can exchange the incoming request's credential for a new, backend-specific token at an OAuth authorization server before forwarding the request.
