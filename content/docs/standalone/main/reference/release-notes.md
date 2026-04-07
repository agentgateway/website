---
title: Release notes
weight: 20
---

Review the release notes for agentgateway standalone.

{{< callout type="info">}}
For more details, review the [GitHub release notes in the agentgateway repository](https://github.com/agentgateway/agentgateway/releases)
{{< /callout >}}

## 🔥 Breaking changes {#v11-breaking-changes}

### MCP authentication moved to route level

<!-- ref: https://github.com/agentgateway/agentgateway/pull/1357 -->

MCP authentication is configured at the route level under `policies.mcpAuthentication`. The route-level placement aligns MCP auth with other route-level policies and allows JWT claims to be used in authorization, rate limiting, and transformation policies.

_Before_: MCP authentication was configured as a backend-level policy.

_After_: MCP authentication is configured under `routes[].policies.mcpAuthentication`.

No YAML structure changes are required for standalone users, as standalone configuration already placed `mcpAuthentication` under route policies. However, if you have automation or tooling that references MCP authentication as a backend-level concept, update it accordingly.

For more information, see [MCP authentication]({{< link-hextra path="/configuration/security/mcp-authn/" >}}).

## 🌟 New features {#v11-new-features}

### OIDC browser authentication

<!-- ref: built-in OIDC with PKCE -->

A new `oidc` route policy provides built-in OpenID Connect browser authentication with PKCE support, encrypted session cookies, and automatic redirect handling. The OIDC policy is a native alternative to deploying an external proxy like oauth2-proxy.

```yaml
policies:
  oidc:
    issuer: http://keycloak.example.com/realms/myrealm
    clientId: agentgateway-browser
    clientSecret: my-secret
    redirectURI: http://localhost:3000/oauth/callback
    scopes:
    - profile
    - email
```

For more information, see [OIDC browser authentication]({{< link-hextra path="/configuration/security/oidc/" >}}).

### L4 network authorization

<!-- ref: NetworkAuthorizationSet -->

A new `networkAuthorization` frontend policy enables Layer 4 network authorization for non-HTTP traffic. You can enforce policies based on source IP, port, and mTLS client identity before HTTP processing begins. Combine with HTTP authorization for layered L4+L7 controls.

```yaml
frontendPolicies:
  networkAuthorization:
    rules:
    - allow: 'source.address.startsWith("10.")'
    - require: 'source.tls.identity == "spiffe://cluster.local/ns/default/sa/my-service"'
```

For more information, see [Network authorization]({{< link-hextra path="/configuration/security/network-authz/" >}}).

### Authorization require rules

Authorization policies now support `require` rules in addition to `allow` and `deny`. The `require` rule type provides clearer semantics for expressing mandatory conditions. All `require` rules must match for the request to proceed.

```yaml
authorization:
  rules:
  - require: 'jwt.aud == "my-service"'
```

For more information, see [HTTP authorization]({{< link-hextra path="/configuration/security/http-authz/" >}}).

### MCP improvements

- **Stateless sessions**: OpenAPI and SSE upstreams can now use stateless sessions, avoiding state persistence for backends that don't need it.
- **Explicit service reference lists**: MCP backends can specify targets with explicit service references.
- **Tool payloads in CEL context**: Tool names and payloads are available in MCP authorization CEL expressions via `mcp.tool.name` and other `mcp.tool.*` fields.

### LLM gateway enhancements

- **Path prefixes**: LLM providers now support `pathPrefix` for custom API base paths.
- **Azure default authentication**: Azure OpenAI providers can use platform-default authentication.
- **Vertex region optional**: Vertex AI region configuration is now optional with a global default.

### Gateway and routing improvements

- **Automatic protocol detection**: A new `auto` bind protocol peeks at the first connection byte to determine TLS vs HTTP, simplifying mixed-protocol environments.
- **Service SANs for upstream TLS**: Upstream TLS now respects Subject Alternative Names from Kubernetes Services.
- **CEL hash functions**: New `sha1.encode`, `sha256.encode`, and `md5.encode` functions are available in CEL expressions.
