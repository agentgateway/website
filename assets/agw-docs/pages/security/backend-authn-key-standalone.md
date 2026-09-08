## About

Use one of the following backend authentication methods to send a static credential to your backend. The client may already send the credential that the backend expects. If it does not, agentgateway must supply one of its own.

* **Static key** (`key`) sends a value that you configure, either inline or from a file on disk.
* **Passthrough** (`passthrough`) sends the JWT that the client sent.
* **Extra credentials** (`credentials`) adds one or more credentials, each to its own location, either on its own or alongside one of the other two methods.

All of them write the credential to the `Authorization` header with a `Bearer ` prefix by default. The `location` field changes where agentgateway writes it.

{{< reuse "agw-docs/snippets/config-styles-note.md" >}}

{{< doc-test paths="backend-authn-key" >}}
{{< reuse "agw-docs/snippets/install-agentgateway-binary.md" >}}
export MY_API_KEY="${MY_API_KEY:-dummy}"
export MY_TENANT_KEY="${MY_TENANT_KEY:-dummy}"
{{< /doc-test >}}

## Static keys

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

{{< doc-test paths="backend-authn-key" >}}
# WHAT THIS TEST VALIDATES:
#   * The static-key backendAuth example config is accepted by agentgateway in
#     both the routing-based (gateways) and simplified MCP (mcp.policies) forms.
# WHAT THIS TEST DOES NOT VALIDATE (and why):
#   * The file-path, location, and passthrough snippets are field-reference
#     fragments with no `gateways:`, so they are not standalone configs as
#     written. The `credentials` fragments at the end of the page are covered by
#     a second test, which wraps each one in the missing scaffolding first.
#   * That a backend accepts any of these credentials -- requires config the page
#     omits: every example points at a placeholder host.
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

## Read the key from a file

You can also add keys via a file path.

```yaml
backendAuth:
  key:
    value:
      file: /path/to/my/key
```

## Change the credential location

By default, agentgateway writes the credential to the `Authorization` header with a `Bearer ` prefix. Set the `location` field to write it somewhere else.

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

## Pass through client credentials

Any form of incoming authentication removes the original credential from the request by default, before agentgateway forwards it to the backend. That applies to [JWT]({{< link-hextra path="/documentation/configuration/security/jwt-authn/" >}}), [API key]({{< link-hextra path="/documentation/configuration/security/apikey-authn/" >}}), and [basic auth]({{< link-hextra path="/documentation/configuration/security/basic-authn/" >}}). To send the original credential on to the backend, use the `passthrough` method.

```yaml
backendAuth:
  passthrough: {}
```

The method forwards a JWT only. It re-sends the token that a [JWT authentication]({{< link-hextra path="/documentation/configuration/security/jwt-authn/" >}}) policy validated on the route. An API key or basic auth credential is still stripped, and `passthrough` does not add it back.

The `passthrough` method has no field for where to read the credential from, because agentgateway does not read it from the request at all. It re-sends the token that the `jwtAuth` policy already validated. The source is therefore wherever that policy's own `location` field reads from, which is the `Authorization` header by default.

The `location` field on `passthrough` controls only where agentgateway writes the token on the backend request. That location does not have to be where the client sent it.

```yaml
backendAuth:
  passthrough:
    location:
      header:
        name: x-forwarded-token
```

> [!NOTE]
> Prefer `passthrough` over the `preserveToken` field of the `jwtAuth` policy. Both get the token to the backend. However, `preserveToken` leaves the token in its original location, where every policy that runs later can read it. The `passthrough` method re-adds the token only on the request that agentgateway forwards to the backend.

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

{{< doc-test paths="backend-authn-key" >}}
# WHAT THIS TEST VALIDATES:
#   * Both `credentials` fragments above are accepted once wrapped in the
#     gateways/routes scaffolding that the page tells the reader to add: the
#     additive form alongside a primary `key`, and the list on its own.
# WHAT THIS TEST DOES NOT VALIDATE (and why):
#   * That the extra credentials arrive at the backend -- covered on the
#     Kubernetes page for this method, which asserts all three against httpbin.
#     Asserting it twice would not test anything new about the data plane.
#   * The tunnel restriction in the note above -- requires config the page omits:
#     a tunnel-bound backend, which belongs to the backend tunnel guide.
echo dummy > subscription-key
credentials_case() {
  local name="$1"
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
  } > "config-credentials-$name.yaml"
  agentgateway -f "config-credentials-$name.yaml" --validate-only
}

credentials_case additive <<'EOF'
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

credentials_case alone <<'EOF'
credentials:
- location:
    header:
      name: x-tenant-key
  key: $MY_TENANT_KEY
EOF

echo "credentials configuration verified"
{{< /doc-test >}}
