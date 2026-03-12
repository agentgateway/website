---
title: Release notes
weight: 20
---

Review the release notes for agentgateway standalone.

{{< callout type="info">}}
For more details, review the [GitHub release notes in the agentgateway repository](https://github.com/agentgateway/agentgateway/releases)
{{< /callout >}}

## 🌟 New features

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
