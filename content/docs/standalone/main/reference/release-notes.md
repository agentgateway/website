---
title: Release notes
weight: 20
---

Review the release notes for agentgateway standalone.

{{< callout type="info">}}
For more details, review the [GitHub release notes in the agentgateway repository](https://github.com/agentgateway/agentgateway/releases)
{{< /callout >}}

## 🌟 New features

### Built-in CEL playground

<!-- ref: https://github.com/agentgateway/agentgateway/pull/914 -->

The agentgateway admin UI now includes a built-in CEL playground for testing CEL expressions against agentgateway's CEL runtime. The playground supports the custom functions and variables specific to agentgateway that are not available in generic CEL environments. To open it, select [**CEL Playground**](http://localhost:15000/ui/cel/) in the admin UI sidebar.

{{< reuse-image src="img/cel-playground.png" >}}
{{< reuse-image-dark srcDark="img/cel-playground-dark.png" >}}

For more information, see [CEL playground]({{< link-hextra path="/reference/cel/#cel-playground" >}}).

### Remote URL support for OpenAPI schemas

<!-- ref: https://github.com/agentgateway/agentgateway/pull/1060 -->

You can now load an OpenAPI schema from a remote URL by setting the `url` field in the `schema` section of your OpenAPI target configuration. Agentgateway fetches the schema at startup. Previously, only local file paths and inline schemas were supported.

```yaml
openapi:
  schema:
    url: https://example.com/api/openapi.json
  host: example.com
```

For more information, see [Connect to an OpenAPI server]({{< link-hextra path="/mcp/connect/openapi/" >}}).

### Backend connection policies for extauth, rate limit, and MCP

<!-- ref: https://github.com/agentgateway/agentgateway/pull/1091 -->

You can now configure backend connection policies directly on `extAuthz`, `remoteRateLimit`, and `mcp` targets to control how agentgateway connects to those services. This lets you configure TLS, authentication, and connection timeouts inline, without separate policy definitions.

**Rate limit example**: 
```yaml
remoteRateLimit:
  host: ratelimit-service:8081
  domain: my-api
  policies:
    backendAuth:
      key:
        file: /secrets/api-key
    backendTLS:
      root: /certs/ca.pem
      insecure: false
    tcp:
      connectTimeout:
        secs: 3
        nanos: 0
  descriptors:
    - entries:
        - key: service
          value: '"my-service"'
  failureMode: failOpen
```

For more information, see [Rate limits]({{< link-hextra path="/configuration/resiliency/rate-limits/#backend-connection-policies" >}}).

**Extauth example**: 
```yaml
extAuthz:
  host: authz-server:9001
  policies:
    backendTLS:
      root: /certs/ca.pem
    backendAuth:
      key:
        file: /secrets/api-key
    http:
      requestTimeout: "5s"
  protocol:
    grpc: {}
```

For more information, see [External authorization]({{< link-hextra path="/configuration/security/external-authz/#backend-connection-policies" >}}) 

**MCP example**:
```yaml
mcp:
  targets:
    - name: my-mcp-server
      sse:
        host: mcp-backend
        port: 8080
      policies:
        backendAuth:
          key:
            file: /secrets/mcp-token
        backendTLS:
          root: /certs/ca.pem
```


### Remote rate limit failure modes

<!-- ref: https://github.com/agentgateway/agentgateway/pull/935 -->

You can now configure how agentgateway behaves when the remote rate limit service is unavailable using the new `failureMode` field. The default behavior is `failClosed`, which denies requests with a `500` status code. Set `failureMode` to `failOpen` to allow requests through when the service is unreachable.

```yaml
remoteRateLimit:
  host: localhost:9090
  domain: example.com
  failureMode: failOpen
  descriptors:
  - entries:
    - key: organization
      value: 'request.headers["x-organization"]'
    type: requests
```

For more information, see [Failure behavior]({{< link-hextra path="/configuration/resiliency/rate-limits/#failure-behavior" >}}).

### JWT claim validation for MCP auth

<!-- ref: https://github.com/agentgateway/agentgateway/pull/897 -->

You can now customize which JWT claims must be present in a token before it is accepted, using the new `jwtValidationOptions.requiredClaims` field in your MCP authentication configuration.

```yaml
mcpAuthentication:
  issuer: http://localhost:9000
  jwks:
    url: http://localhost:9000/.well-known/jwks.json
  jwtValidationOptions:
    requiredClaims:
      - exp
      - aud
      - sub
```

For more information, see [JWT claim validation]({{< link-hextra path="/mcp/mcp-authn/#jwt-claim-validation" >}}).
