---
title: Release notes
weight: 20
description: Review the release notes for agentgateway.
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

### MCP improvements

- **Stateless sessions**: MCP upstreams can now use stateless sessions. For more information, see [Stateful MCP]({{< link-hextra path="/mcp/session/" >}}).
- **Explicit service reference lists**: MCP backends can specify targets with explicit service references. For more information, see [Static MCP]({{< link-hextra path="/mcp/static-mcp/" >}}).
- **Tool payloads in CEL context**: Tool names and payloads are available in logging CEL expressions.

### LLM gateway enhancements

- **Path prefixes**: LLM providers now support path prefixes for custom API base paths.
- **Azure default authentication**: Azure OpenAI providers can use platform-default authentication. For more information, see [Azure OpenAI]({{< link-hextra path="/llm/providers/azure/" >}}).
- **Vertex region optional**: Vertex AI region configuration is now optional with a global default. For more information, see [Vertex AI]({{< link-hextra path="/llm/providers/vertex/" >}}).

### Gateway and routing improvements

- **Automatic protocol detection**: A new `auto` bind protocol auto-detects TLS vs HTTP connections.
- **Service SANs for upstream TLS**: Upstream TLS now respects Subject Alternative Names from Kubernetes Services. For more information, see [BackendTLS]({{< link-hextra path="/security/backendtls/" >}}).
- **TLSRoute v1 status**: Status is now written using the `TLSRoute v1` API version.
- **CEL hash functions**: New `sha1.encode`, `sha256.encode`, and `md5.encode` functions are available in CEL expressions.

## 🗑️ Deprecated or removed features

### MCP authentication on backend AgentgatewayPolicy

As described in the breaking changes section, MCP authentication is now configured at the route level using `traffic.jwtAuthentication` with the `mcp` extension field, instead of the previous `backend.mcp.authentication` field.

The `backend.mcp.authentication` field on the AgentgatewayPolicy resource is deprecated and will be removed in a future release.

### MCP policy on AgentgatewayBackend

<!-- PR https://github.com/agentgateway/agentgateway/pull/1437 -->

Previously, AgentgatewayBackend resources had fields for `spec.mcp.targets.static.policies.mcp.{authentication,authorization}`.

These fields were not intended to be set, and had no impact on the behavior of the proxy.

As such, these fields are now removed.

If you previously set these fields which had no behavioral impact and were ignored, the configuration now fails to be applied.

Instead, use the `jwtAuthentication.mcp` field on the AgentgatewayPolicy resource, which ensures authentication runs before other policies such as transformation and rate limiting.
