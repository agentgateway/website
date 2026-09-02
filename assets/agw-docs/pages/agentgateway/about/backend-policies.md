Backend policies control how agentgateway connects to and communicates with a
destination after route selection. Use them to configure connection deadlines,
TLS, credentials, transformations, health checks, and workload-specific AI or
Model Context Protocol (MCP) behavior.

Unlike a `traffic` policy, which processes a request as it passes through a
Gateway listener or route, a `backend` policy applies to the selected
destination. You can attach the same backend settings broadly at a Gateway or
route, or narrowly to one Kubernetes Service or
{{< reuse "agw-docs/snippets/backend.md" >}}.

## Choose an attachment point

Attach an {{< reuse "agw-docs/snippets/policy.md" >}} to the narrowest resource
that represents the destinations that need the settings.

| Target | When to use it | Optional scope |
| -- | -- | -- |
| Gateway or ListenerSet | Set defaults for every backend reached through the Gateway or ListenerSet. | For a Gateway, use `sectionName` to select one listener. |
| HTTPRoute or GRPCRoute | Apply settings to every backend referenced by a route. | Use `sectionName` to select one named route rule. |
| Kubernetes Service | Configure one Service independently of the routes that use it. | Use `sectionName` to select one numeric Service port. |
| {{< reuse "agw-docs/snippets/backend.md" >}} | Configure one AI, MCP, static, or other agentgateway backend. | Use `sectionName` to select one named sub-backend, such as an AI provider. |

The policy must be in the same namespace as its target. A Service-targeted
policy takes effect after a route or another agentgateway resource references
the Service and adds it to the proxy configuration.

The following example gives every request to the `payments` Service five
seconds to receive a response.

```yaml
apiVersion: {{< reuse "agw-docs/snippets/api-version.md" >}}
kind: {{< reuse "agw-docs/snippets/policy.md" >}}
metadata:
  name: payments-backend
  namespace: payments
spec:
  targetRefs:
  - group: ""
    kind: Service
    name: payments
  backend:
    http:
      requestTimeout: 5s
```

For the full targeting and precedence rules, see
[Targeting and merging]({{< link-hextra path="/about/policies/target-merge/" >}}).

## Backend policy settings

Combine fields in one policy when they have the same target and lifecycle. If
different teams manage the settings, you can attach multiple policies as long
as they do not set the same field at the same specificity.

| Field | Purpose | Guide |
| -- | -- | -- |
| `backend.tcp` | Set the connection timeout and TCP keepalive probes. | [Backend timeouts]({{< link-hextra path="/resiliency/timeouts/backend/" >}}) and [HTTP connection settings]({{< link-hextra path="/resiliency/connection/#backend" >}}) |
| `backend.http` | Select the upstream HTTP version and set the backend response deadline. | [Backend timeouts]({{< link-hextra path="/resiliency/timeouts/backend/" >}}) and [HTTP connection settings]({{< link-hextra path="/resiliency/connection/#backend" >}}) |
| `backend.tls` | Originate TLS or mutual TLS (mTLS) and configure certificate validation. | [Backend TLS]({{< link-hextra path="/security/backendtls/" >}}) |
| `backend.tunnel` | Reach the destination through an HTTP CONNECT proxy. | [Policy API reference]({{< link-hextra path="/reference/api/" >}}) |
| `backend.auth` | Add credentials or exchange, sign, or pass through tokens for the destination. | [Backend authentication]({{< link-hextra path="/security/backend-authn/" >}}) |
| `backend.extAuth` | Run external authorization after agentgateway selects the destination. | [Bring your own external authorization service]({{< link-hextra path="/security/extauth/byo-ext-auth-service/" >}}) |
| `backend.transformation` | Transform requests sent to the destination and responses returned from it. | [Transformations]({{< link-hextra path="/traffic-management/transformations/" >}}) |
| `backend.health` | Detect unhealthy endpoints, evict them, and restore them after recovery. | [Backend health]({{< link-hextra path="/resiliency/backend-health/" >}}) |
| `backend.ai` | Configure prompt guards, routing, transformations, and other AI-specific behavior. | [LLM features]({{< link-hextra path="/llm/" >}}) |
| `backend.mcp` | Configure MCP authorization, authentication, and guardrails. | [MCP features]({{< link-hextra path="/mcp/" >}}) |

> [!NOTE]
> `backend.ai` and `backend.mcp` cannot target a Kubernetes Service. Attach
> these fields to an {{< reuse "agw-docs/snippets/backend.md" >}}, a route, or
> a broader resource instead.

## Attached and inline policies

You can attach an {{< reuse "agw-docs/snippets/policy.md" >}} to an
{{< reuse "agw-docs/snippets/backend.md" >}}, or set supported backend policies
inline on the backend and its sub-backends. Inline settings are more specific
and override the same field from an attached policy. Settings that do not
conflict merge at field level.

Use an attached policy when you want to manage policy separately from the
backend definition or apply defaults to multiple destinations. Use inline
settings when the configuration belongs to one backend or provider and should
move with that definition.

## Avoid policy conflicts

Backend policies merge by attachment specificity. More specific targets
override the same field from broader targets. For example, a Service policy can
override `backend.http` from a route policy while continuing to inherit
`backend.tcp` from that route policy.

Do not attach two policies at the same specificity that set the same field.
Agentgateway cannot deterministically choose between them, even though both
policies might report `Accepted` and `Attached` status conditions.

To inspect the effective backend policies, use the proxy configuration dump as
shown in [Inspect agentgateway configuration]({{< link-hextra path="/operations/inspect-config/" >}}).
