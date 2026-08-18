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
export MY_TENANT_KEY="${MY_TENANT_KEY:-dummy}"
export AWS_ACCESS_KEY_ID="${AWS_ACCESS_KEY_ID:-AKIAIOSFODNN7EXAMPLE}"
export AWS_SECRET_ACCESS_KEY="${AWS_SECRET_ACCESS_KEY:-dummy}"
export AWS_SESSION_TOKEN="${AWS_SESSION_TOKEN:-dummy}"
{{< /doc-test >}}

Backend authentication is how agentgateway proves its own identity to an upstream service. It is separate from client authentication, which is how a client proves its identity to agentgateway. A route can use both: agentgateway validates the client credential, strips it, and then attaches its own credential to the request that it forwards.

## Backend authentication methods

{{< reuse "agw-docs/pages/security/backend-authn-methods.md" >}}

> [!IMPORTANT]
> The field is `policies.backendAuth` in the standalone binary. In Kubernetes, the same settings live under `spec.backend.auth` on an `AgentgatewayPolicy` or under `spec.policies.auth` on an `AgentgatewayBackend`, and several of them use a different shape as well as a different name. Do not copy a configuration block between the two modes. For the differences, see [Backend authentication](https://agentgateway.dev/docs/kubernetes/latest/security/backend-authn/) in the Kubernetes documentation.

## Configuration examples

To attach an authentication token to each request that agentgateway sends to a backend, use the backend authentication policy.

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
#   * The file-path, location, and passthrough snippets are field-reference
#     fragments with no `gateways:`, so they are not standalone configs. The
#     gcp, aws, and credentials fragments are covered further down this page,
#     where a helper wraps each one in the missing scaffolding first.
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

To connect to a Google Cloud service, use `gcp`. Agentgateway reads [Application Default Credentials](https://docs.cloud.google.com/docs/authentication/application-default-credentials) from the environment and attaches a token to each request.

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

## AWS credentials

To sign requests to an AWS service, use `aws`. Unlike the other methods, `aws` does not attach a token. It computes an AWS Signature Version 4 signature over the request, so it runs last, after every other policy that changes the request.

Name an access key explicitly, or omit the credential fields to use the standard AWS credential chain.

```yaml
backendAuth:
  aws:
    accessKeyId: "$AWS_ACCESS_KEY_ID"
    secretAccessKey: "$AWS_SECRET_ACCESS_KEY"
    sessionToken: "$AWS_SESSION_TOKEN"
    region: us-west-2
    serviceName: execute-api
```

```yaml
backendAuth:
  aws:
    region: us-east-1
    serviceName: bedrock
```

{{< reuse "agw-docs/snippets/review-table.md" >}}

| Field | Description |
| -- | -- |
| `accessKeyId` and `secretAccessKey` | An explicit access key. Set both together, or omit both to use the credential chain. |
| `sessionToken` | Session token that goes with a temporary access key. |
| `region` | Signing region, such as `us-east-1`. Set the field when the target service is in a different region from agentgateway. A typed AWS backend may supply the region on its own. |
| `serviceName` | Signing service name, such as `bedrock`, `bedrock-agentcore`, or `execute-api`. A typed AWS backend may supply the name on its own. |
| `assumeRole` | IAM role to assume before signing. Available with the credential chain only, so do not set an access key alongside it. |

### AWS credential resolution order

When you omit `accessKeyId` and `secretAccessKey`, agentgateway uses the [default credential chain](https://docs.aws.amazon.com/sdkref/latest/guide/access.html) of the AWS SDK. The chain tries the following sources in order and stops at the first one that returns credentials.

1. **Environment variables:** `AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY`, and `AWS_SESSION_TOKEN`.
2. **Shared configuration files:** `~/.aws/config` and `~/.aws/credentials`.
3. **Web identity token:** `AWS_WEB_IDENTITY_TOKEN_FILE` and `AWS_ROLE_ARN`. This is the source that IAM roles for service accounts and EKS Pod Identity use.
4. **Container credentials:** the credential endpoint that Amazon ECS and other container hosts provide.
5. **Instance metadata:** IMDSv2 on an EC2 instance.

### Assume a role

To sign with a role rather than with the identity of agentgateway, set `assumeRole`. Agentgateway calls the AWS Security Token Service (STS) with the credentials from the chain, and signs with the credentials that STS returns. It caches the assumed credentials and refreshes them before they expire.

The session name and the session tags exist for cost attribution. Each accepts a static value, or a CEL expression that agentgateway evaluates against every request, which lets one gateway attribute cost per user or per team.

```yaml
backendAuth:
  aws:
    region: us-east-1
    serviceName: bedrock
    assumeRole:
      roleArn: arn:aws:iam::123456789012:role/agentgateway-bedrock
      sessionName:
        expression: jwt.sub
      tags:
      - key: team
        value: platform
      - key: user
        expression: jwt.sub
```

{{< reuse "agw-docs/snippets/review-table.md" >}}

| Field | Description |
| -- | -- |
| `assumeRole.roleArn` | Required ARN of the IAM role to assume. |
| `assumeRole.sessionName` | Session name (`RoleSessionName`) that appears in AWS CloudTrail and in the Cost and Usage Report. Either a static string, or `{expression: <cel>}`. Two to 64 characters, matching `[\w+=,.@-]`. Omit the field and AWS generates a random name. |
| `assumeRole.tags` | Session tags that agentgateway passes to STS. Each tag sets `key`, plus exactly one of `value` for a static value or `expression` for a CEL expression. STS allows at most 50 tags for one role session. |

> [!NOTE]
> A session tag reaches the Cost and Usage Report as `resourceTags/user:<TagKey>`, but only after you activate the tag key as a cost allocation tag in the AWS Billing console.

> [!WARNING]
> A CEL expression that does not produce a valid session name or tag value at request time causes agentgateway to reject that request. An expression such as `jwt.sub` therefore makes the route depend on a client authentication policy that populates the JWT claims. The failure is per-request, and `--validate-only` does not catch it.

{{< doc-test paths="backend-authn" >}}
# WHAT THIS TEST VALIDATES:
#   * Every gcp, aws, and credentials fragment shown above is accepted once it is wrapped in the
#     gateways/routes scaffolding that the page tells the reader to add.
#   * The Google token type really is camelCase. The PascalCase spelling that the Kubernetes CRDs
#     use is rejected here, which is what the IMPORTANT note claims.
#   * audience belongs to idToken only.
# WHAT THIS TEST DOES NOT VALIDATE (and why):
#   * That any cloud credential authenticates -- external dependency: needs a real Google or AWS
#     account and identity. Only the config shapes are asserted.
#   * The credential-resolution orders -- external dependency: exercising a rung of either chain
#     means supplying the credential it looks for, on the host type it looks on.
#   * The Cost and Usage Report behavior of assumeRole session tags -- different layer: the tag is
#     sent to STS, and the report is an AWS billing artifact that appears hours later.
authn_case() {
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
EOF
    sed 's/^/        /'
  } > "config-authn-$name.yaml"
  if agentgateway -f "config-authn-$name.yaml" --validate-only > "authn-$name.log" 2>&1; then
    [ "$expect" = ok ] || { echo "FAIL: $name was accepted but should be rejected"; exit 1; }
    echo "ok       $name"
  else
    [ "$expect" = fail ] || { echo "FAIL: $name was rejected"; cat "authn-$name.log"; exit 1; }
    echo "rejected $name (as expected)"
  fi
}

authn_case gcp-implicit ok <<'EOF'
gcp: {}
EOF

authn_case gcp-access-token ok <<'EOF'
gcp:
  type: accessToken
EOF

authn_case gcp-id-token ok <<'EOF'
gcp:
  type: idToken
  audience: "https://my-cloudrun-service-xyz.run.app"
EOF

# The Kubernetes spelling must not be accepted here.
authn_case gcp-pascal-access-token fail <<'EOF'
gcp:
  type: AccessToken
EOF

authn_case gcp-pascal-id-token fail <<'EOF'
gcp:
  type: IdToken
  audience: "https://my-cloudrun-service-xyz.run.app"
EOF

authn_case gcp-audience-on-access-token fail <<'EOF'
gcp:
  type: accessToken
  audience: "https://my-cloudrun-service-xyz.run.app"
EOF

authn_case aws-explicit ok <<'EOF'
aws:
  accessKeyId: "$AWS_ACCESS_KEY_ID"
  secretAccessKey: "$AWS_SECRET_ACCESS_KEY"
  sessionToken: "$AWS_SESSION_TOKEN"
  region: us-west-2
  serviceName: execute-api
EOF

authn_case aws-implicit ok <<'EOF'
aws:
  region: us-east-1
  serviceName: bedrock
EOF

authn_case aws-assume-role ok <<'EOF'
aws:
  region: us-east-1
  serviceName: bedrock
  assumeRole:
    roleArn: arn:aws:iam::123456789012:role/agentgateway-bedrock
    sessionName:
      expression: jwt.sub
    tags:
    - key: team
      value: platform
    - key: user
      expression: jwt.sub
EOF

# A tag sets exactly one of value and expression.
authn_case aws-tag-both fail <<'EOF'
aws:
  assumeRole:
    roleArn: arn:aws:iam::123456789012:role/agentgateway-bedrock
    tags:
    - key: team
      value: platform
      expression: jwt.sub
EOF

echo dummy > subscription-key
authn_case credentials-additive ok <<'EOF'
key:
  value: $MY_API_KEY
credentials:
- location:
    header:
      name: x-tenant-key
  key: $MY_TENANT_KEY
- location:
    queryParameter:
      name: subscription
  key:
    file: subscription-key
EOF

authn_case credentials-only ok <<'EOF'
credentials:
- location:
    header:
      name: x-tenant-key
  key: $MY_TENANT_KEY
EOF

echo "gcp, aws, and credentials configuration verified"
{{< /doc-test >}}

## Azure credentials

To connect to an Azure service, use `azure`. The method has five credential modes, including a service principal, a managed identity, and a workload identity. For the modes, the resolution order that the implicit mode follows, and a field-name gotcha to avoid, see [Azure backend authentication]({{< link-hextra path="/configuration/security/backend-authn/azure/" >}}).

## GitHub Copilot

To connect to the GitHub Copilot API, use `copilot`. Agentgateway finds the token in your environment and adds the request headers that Copilot expects, so no credential appears in the configuration file. For the token sources and the headers, see [GitHub Copilot backend authentication]({{< link-hextra path="/configuration/security/backend-authn/copilot/" >}}).

```yaml
backendAuth: copilot
```

> [!NOTE]
> The `copilot` method is available in the standalone binary only.

## Send more than one credential

Some upstreams want two credentials on the same request, such as a bearer token and a subscription key. The `credentials` list covers that case. Each entry sets a `location` and a `key`, and the list is independent of the primary method, so you can set it on its own or together with one.

```yaml
backendAuth:
  key:
    value: $MY_API_KEY
  credentials:
  - location:
      header:
        name: x-tenant-key
    key: $MY_TENANT_KEY
  - location:
      queryParameter:
        name: subscription
    key:
      file: /etc/agentgateway/subscription-key
```

The policy in the example sends three credentials on every request: the `Authorization` header from `key`, an `x-tenant-key` header, and a `subscription` query parameter.

{{< reuse "agw-docs/snippets/review-table.md" >}}

| Field | Description |
| -- | -- |
| `credentials[].location` | Required location that agentgateway writes this credential to. Set exactly one of `header`, `queryParameter`, or `cookie`. Each entry carries its own location. |
| `credentials[].key` | Required credential value, either inline or as `{file: <path>}`. |

> [!NOTE]
> The `credentials` list is not supported on a backend that agentgateway reaches through a tunnel. A tunnel-bound backend supports the `key` method only.

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
