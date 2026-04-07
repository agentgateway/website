---
title: Release notes
weight: 20
test: skip
---

Review the release notes for agentgateway.

{{< callout type="info">}}
For more details, review the [GitHub release notes in the agentgateway repository](https://github.com/agentgateway/agentgateway/releases)
{{< /callout >}}

## 🔥 Breaking changes {#v11-breaking-changes}

### MCP authentication moved to route level

<!-- ref: https://github.com/agentgateway/agentgateway/pull/1357 -->

MCP authentication is configured at the traffic (route) level using `traffic.jwtAuthentication` with the `mcp` extension field, instead of the previous `backend.mcp.authentication` field. The route-level placement aligns MCP auth with standard JWT authentication and allows JWT claims to be used in other traffic policies such as authorization, rate limiting, and transformations.

* **Before**: MCP authentication was configured under `backend.mcp.authentication`, targeting an {{< reuse "agw-docs/snippets/agentgateway/agentgatewaybackend.md" >}}. This previous `backend.mcp.authentication` field is deprecated but continues to work for backward compatibility. If both are set on the same route, the backend-level configuration is ignored.
* **After**: MCP authentication is configured under `traffic.jwtAuthentication` with an `mcp` field, targeting an HTTPRoute, such as in the following example. For more information, see [Set up MCP auth]({{< link-hextra path="/mcp/auth/setup/" >}}).

```yaml
apiVersion: {{< reuse "agw-docs/snippets/trafficpolicy-apiversion.md" >}}
kind: {{< reuse "agw-docs/snippets/trafficpolicy.md" >}}
metadata:
  name: mcp-authn
spec:
  targetRefs:
  - group: gateway.networking.k8s.io
    kind: HTTPRoute
    name: mcp
  traffic:
    jwtAuthentication:
      mode: Strict
      providers:
      - issuer: http://keycloak.example.com/realms/myrealm
        audiences:
        - http://localhost:8080/mcp
        jwks:
          remote:
            backendRef:
              name: keycloak
              kind: Service
              namespace: keycloak
              port: 8080
            jwksPath: /realms/master/protocol/openid-connect/certs
      mcp:
        provider: Keycloak
        resourceMetadata:
          resource: http://localhost:8080/mcp
          scopesSupported:
          - email
          bearerMethodsSupported:
          - header
```

## 🌟 New features {#v11-new-features}

### Network authorization

A new `networkAuthorization` field in the `frontend` policy section enables Layer 4 network authorization based on source IP, port, and mTLS client identity. You can enforce policies for non-HTTP traffic and layer L4+L7 controls. For more information, see [Policies]({{< link-hextra path="/about/policies/" >}}).

### Authorization require rules

Authorization policies now support `Require` as an action in addition to `Allow` and `Deny`. All `Require` rules must match for the request to proceed, providing clearer semantics than double-negative deny rules. For more information, see [Policies]({{< link-hextra path="/about/policies/" >}}).

### CEL hash functions

New hash encoding functions are available in CEL expressions: `sha256.encode`, `sha1.encode`, and `md5.encode`. Each accepts a string or bytes value and returns the lowercase hex-encoded digest.

### MCP improvements

- **Stateless sessions**: OpenAPI and SSE upstreams can now use stateless sessions. For more information, see [Stateful MCP]({{< link-hextra path="/mcp/session/" >}}).
- **Explicit service reference lists**: MCP backends can specify targets with explicit service references. For more information, see [Static MCP]({{< link-hextra path="/mcp/static-mcp/" >}}).
- **Tool payloads in CEL context**: Tool names and payloads are available in MCP authorization CEL expressions. For more information, see [Tool access]({{< link-hextra path="/mcp/tool-access/" >}}).
- **Merged upstream instructions**: Multiplexed MCP upstream instructions are now merged more cleanly.
- **Bug fixes**: Fixes for several MCP edge cases, including Keycloak auth handling and upstream stdio failure behavior.

### LLM gateway enhancements

- **Path prefixes**: LLM providers now support path prefixes for custom API base paths.
- **Azure default authentication**: Azure OpenAI providers can use platform-default authentication. For more information, see [Azure OpenAI]({{< link-hextra path="/llm/providers/azureopenai/" >}}).
- **Vertex region optional**: Vertex AI region configuration is now optional with a global default. For more information, see [Vertex AI]({{< link-hextra path="/llm/providers/vertex/" >}}).
- **New response fields**: You can now route or observe newer response fields including `serviceTier`, image, and audio token usage.
- **Bedrock improvements**: Better handling for Claude-style traffic and buffer limits.

### Gateway and routing improvements

- **Automatic protocol detection**: A new `auto` bind protocol auto-detects TLS vs HTTP connections.
- **Routes on Services**: You can now attach routes directly to Services.
- **Readiness improvements**: The gateway waits for binds to become ready before reporting readiness.
- **Service SANs for upstream TLS**: Upstream TLS now respects Subject Alternative Names from Kubernetes Services. For more information, see [BackendTLS]({{< link-hextra path="/security/backendtls/" >}}).
- **TLSRoute v1 status**: Status is now written using the `TLSRoute v1` API version.

### Better observability

Retry metrics and support for the standard `OTEL_SERVICE_NAME` and `OTEL_RESOURCE_ATTRIBUTES` OpenTelemetry environment variables are now available. These changes make it easier to integrate with existing OpenTelemetry conventions without additional gateway-specific configuration.

## 🛠️ Fixes and quality improvements {#v11-fixes}

- Better handling for invalid route backends.
- Improved failure modes for translation, external auth, and remote rate limiting.
- Better routing of non-success streaming responses through buffered error paths.
- Improved listener selection for misdirected requests and HBONE paths.
- General dependency cleanup and refactoring across the controller and runtime.

## 🗑️ Deprecated or removed features {#v11-removed-features}

* **Backend-level MCP authentication**: MCP authentication on the backend is deprecated. Use route-level MCP authentication instead. See [Breaking changes](#v11-breaking-changes).
