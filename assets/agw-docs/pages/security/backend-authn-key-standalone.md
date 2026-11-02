## About

Use one of the following backend authentication methods to send a static credential to your backend. The client may already send the credential that the backend expects. If it does not, agentgateway must supply one of its own.

* **Static key** (`key`) sends a value that you configure, either inline or from a file on disk.{{< version exclude-if="1.0.x,1.1.x,1.2.x,1.3.x,1.4.x,1.5.x,1.6.x,2.2.x" >}} You can also [compute the value from the request](#key-expression) with a CEL expression.{{< /version >}}
* **Passthrough** (`passthrough`) sends the JWT that the client sent.
* **Extra credentials** (`credentials`) adds one or more credentials, each to its own location, either on its own or alongside one of the other two methods.

All of them write the credential to the `Authorization` header with a `Bearer ` prefix by default. The `location` field changes where agentgateway writes it.

{{< reuse "agw-docs/snippets/config-styles-note.md" >}}

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

The remaining examples on this page show only the `backendAuth` policy. Attach each one to a backend under `backends[].policies`, as shown in the complete example above.

## Read the key from a file

You can also add keys via a file path.

```yaml
backendAuth:
  key:
    value:
      file: /path/to/my/key
```

{{% version exclude-if="1.0.x,1.1.x,1.2.x,1.3.x,1.4.x,1.5.x,1.6.x,2.2.x" %}}
## Compute the key from the request {#key-expression}

Instead of a fixed value, you can compute the credential for each request with a [CEL]({{< link-hextra path="/reference/cel/" >}}) expression. Set `expression` instead of `value`. For example, an [external authorization]({{< link-hextra path="/documentation/configuration/security/external-authz/" >}}) policy can return a token for the backend as metadata, and the expression reads the token from the `extauthz` variable.

```yaml
backendAuth:
  key:
    # The extAuthz policy on this route sets backend_token in its metadata.
    expression: extauthz.backend_token
```

Review the following behavior before you use an expression:

* Set exactly one of `value` or `expression`. Configuration validation fails if you set both or neither.
* The expression must return a string. If the expression fails or returns another type, agentgateway sends no credential and removes any existing value from the target location. For example, with the default location, the `Authorization` header, agentgateway removes the `Authorization` header that the client sent. The client's header is not used as a fallback. To learn about the default location, see [Change the credential location](#change-the-credential-location).
* The `location` field works the same way as it does for a static value.
* A backend that agentgateway reaches through a tunnel does not support `expression`. Requests to that backend fail.
{{% /version %}}

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
| `credentials[].key` | Credential value, either inline or as `{file: <path>}`.{{< version include-if="1.6.x" >}} Required.{{< /version >}}{{< version exclude-if="1.0.x,1.1.x,1.2.x,1.3.x,1.4.x,1.5.x,1.6.x,2.2.x" >}} Required unless you set `expression`. Do not set both.{{< /version >}} |{{< version exclude-if="1.0.x,1.1.x,1.2.x,1.3.x,1.4.x,1.5.x,1.6.x,2.2.x" >}}
| `credentials[].expression` | CEL expression that computes the credential value from the request. Required unless you set `key`. Do not set both. The expression follows the same rules as in [Compute the key from the request](#key-expression), so a failed expression clears the location of this entry. |{{< /version >}}

{{% version exclude-if="1.0.x,1.1.x,1.2.x,1.3.x,1.4.x,1.5.x,1.6.x,2.2.x" %}}
For example, the following entry sends the `sub` claim of the validated JWT in an `x-user-id` header.

```yaml
backendAuth:
  credentials:
  - location:
      header:
        name: x-user-id
    expression: jwt.sub
```
{{% /version %}}

> [!NOTE]
> The `credentials` list is not supported on a backend that agentgateway reaches through a tunnel. A tunnel-bound backend supports the `key` method only.
