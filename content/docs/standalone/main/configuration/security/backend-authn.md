---
title: Backend authentication
weight: 10
description: Attach authentication tokens to outgoing backend requests.
test:
  backend-authn:
  - file: ${versionRoot}/configuration/security/backend-authn.md
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
binds:
- port: 3000
  listeners:
  - routes:
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
#     both the routing-based (binds) and simplified MCP (mcp.policies) forms.
# WHAT THIS TEST DOES NOT VALIDATE (and why):
#   * The other backendAuth snippets on this page (file path, location,
#     passthrough, gcp, aws, crossAppAccess) are field-reference fragments
#     with no `binds:`, so they are not standalone configs and are not
#     tested here.
cat <<'EOF' > config.yaml
# yaml-language-server: $schema=https://agentgateway.dev/schema/config
binds:
- port: 3000
  listeners:
  - routes:
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

## Cross App Access (ID-JAG)

The `crossAppAccess` method implements the [OAuth Identity Assertion Authorization Grant](https://datatracker.ietf.org/doc/draft-ietf-oauth-identity-assertion-authz-grant/), also called "ID-JAG" or "Cross App Access". With this method, agentgateway calls a downstream API *as the authenticated end user*, without requiring the user to interactively log in to that downstream app. This pattern is common in agentic scenarios where an agent calls other apps' APIs on behalf of the user.

The gateway acts as a confidential OAuth client and performs a two-leg exchange on each backend call:

1. **Authenticate the user.** The inbound request carries the user's OIDC ID token, validated by the [`jwtAuth` policy]({{< link-hextra path="/configuration/security/jwt-authn/" >}}). The validated token is the subject of the exchange. The `jwtAuth` policy must validate an OIDC ID token, not an arbitrary access token, because the identity provider expects an ID token as the subject.
2. **Token exchange.** The gateway calls the user's identity provider (IdP) authorization server with an [RFC 8693](https://datatracker.ietf.org/doc/html/rfc8693) token exchange and receives an ID-JAG assertion that is bound to the resource authorization server.
3. **JWT-bearer grant.** The gateway presents the ID-JAG to the resource's authorization server with an [RFC 7523](https://datatracker.ietf.org/doc/html/rfc7523) JWT-bearer grant and receives a Bearer access token that is scoped to the downstream API.
4. **Attach and cache.** The Bearer token is added as `Authorization: Bearer <token>` to the upstream request and cached until shortly before it expires.

The following configuration from the [`traffic-identity-assertion` example](https://github.com/agentgateway/agentgateway/tree/main/examples/traffic-identity-assertion) in the agentgateway repository configures the `crossAppAccess` method next to the `jwtAuth` policy that authenticates the user. Note that the gateway requires two separate client registrations, one at the IdP and one at the resource authorization server, each with its own client ID and credentials.

{{% github-yaml url="https://agentgateway.dev/examples/traffic-identity-assertion/config.yaml" %}}

| Setting | Description |
| -- | -- |
| `identityProvider` | The user's IdP authorization server token endpoint. Agentgateway sends the authenticated ID token as the RFC 8693 `subject_token`. Reference the endpoint as a `host`, `service`, or `backend`, and set the `tokenEndpointPath`, which defaults to `/`. |
| `resourceAuthorizationServer` | The resource authorization server token endpoint. This leg uses the RFC 7523 JWT-bearer grant, with the ID-JAG from the IdP leg sent as the assertion. Note that this is a separate client registration from the IdP one. |
| `clientAuth` | Client authentication for each token endpoint. Supported methods are `clientSecretBasic`, `clientSecretPost`, and `privateKeyJwt`. |
| `audience` | Required identifier of the resource authorization server. The issued ID-JAG is bound to this value. |
| `resources` | Optional protected resource or API identifiers ([RFC 8707](https://datatracker.ietf.org/doc/html/rfc8707)). Configure these explicitly when the authorization server expects them. |
| `scopes` | Optional scopes to request. The authorization server might grant a subset. |
| `cache` | Optional token cache configuration. Defaults to an in-memory cache with 8192 entries. Set `cache.defaultTtl` as a fallback for when the token response omits `expires_in` (defaults to `300s`), and `cache.maxEntries: 0` to disable caching. The cache duration is capped by the subject token's JWT `exp` claim when present. |

Enterprise IdPs such as Okta commonly require the `privateKeyJwt` client authentication method, in which the gateway authenticates with a signed JWT assertion instead of a client secret. Because token endpoints are configured as backend references rather than raw URLs, `privateKeyJwt` requires an explicit `assertionAudience`:

```yaml
clientAuth:
  clientId: gateway-at-chat
  method: privateKeyJwt
  signingKey:
    file: /path/to/signing-key.pem
  alg: RS256  # one of RS256/RS384/RS512/ES256/ES384
  kid: my-signing-key  # optional `kid` header
  assertionAudience: https://chat.example.com/oauth2/token
```

{{< callout type="info" >}}
The following parts of the Identity Assertion Authorization Grant draft are not yet supported: DPoP sender-constrained tokens (RFC 9449), `.well-known` endpoint discovery (RFC 8414, endpoints must be configured explicitly), and SAML or refresh-token subject types (only OIDC ID tokens are used as the subject).
{{< /callout >}}
