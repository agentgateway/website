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

_Before_: MCP authentication was configured under `backend.mcp.authentication`, targeting an {{< reuse "agw-docs/snippets/agentgateway/agentgatewaybackend.md" >}}.

_After_: MCP authentication is configured under `traffic.jwtAuthentication` with an `mcp` field, targeting an HTTPRoute.

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

The previous `backend.mcp.authentication` field is deprecated but continues to work for backward compatibility. If both are set on the same route, the backend-level configuration is ignored.

For more information, see [Set up MCP auth]({{< link-hextra path="/mcp/auth/setup/" >}}).

## 🌟 New features {#v11-new-features}

### Network authorization

A new `networkAuthorization` field in the `frontend` policy section enables Layer 4 network authorization based on source IP, port, and mTLS client identity. You can enforce policies for non-HTTP traffic and layer L4+L7 controls.

### Authorization require rules

Authorization policies now support `Require` as an action in addition to `Allow` and `Deny`. All `Require` rules must match for the request to proceed, providing clearer semantics than double-negative deny rules.

### MCP improvements

- **Stateless sessions**: OpenAPI and SSE upstreams can now use stateless sessions.
- **Explicit service reference lists**: MCP backends can specify targets with explicit service references.
- **Tool payloads in CEL context**: Tool names and payloads are available in MCP authorization CEL expressions.

### LLM gateway enhancements

- **Path prefixes**: LLM providers now support path prefixes for custom API base paths.
- **Azure default authentication**: Azure OpenAI providers can use platform-default authentication.
- **Vertex region optional**: Vertex AI region configuration is now optional with a global default.

### Gateway and routing improvements

- **Automatic protocol detection**: A new `auto` bind protocol auto-detects TLS vs HTTP connections.
- **Service SANs for upstream TLS**: Upstream TLS now respects Subject Alternative Names from Kubernetes Services.
- **TLSRoute v1 status**: Status is now written using the `TLSRoute v1` API version.
- **CEL hash functions**: New `sha1.encode`, `sha256.encode`, and `md5.encode` functions are available in CEL expressions.
