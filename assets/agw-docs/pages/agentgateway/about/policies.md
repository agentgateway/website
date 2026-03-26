The {{< reuse "agw-docs/snippets/agentgateway/agentgatewaypolicy.md" >}} custom resource lets you apply traffic management, security, observability, and backend connection policies to your agentgateway resources.

## Policy sections

Each {{< reuse "agw-docs/snippets/agentgateway/agentgatewaypolicy.md" >}} has three top-level sections in the `spec` field that control different stages of request processing. You can include one or more of these sections in a single policy.

| Section | Description | Available fields |
| -- | -- | -- |
| `frontend` | Controls how the gateway accepts incoming connections. Applies at the gateway level before routing decisions. | `tcp`, `tls`, `http`, `accessLog`, `tracing` |
| `traffic` | Controls how agentgateway processes traffic. Applies at the listener, route, or route rule level. Fields are listed in execution order. | `cors`, `jwtAuthentication`, `basicAuthentication`, `apiKeyAuthentication`, `extAuth`, `authorization`, `rateLimit`, `extProc`, `transformation`, `csrf`, `headerModifiers`, `hostRewrite`, `directResponse`, `timeouts`, `retry` |
| `backend` | Controls how agentgateway connects to destination backends. Applies at the backend, service, route, or gateway level. | `tcp`, `tls`, `http`, `tunnel`, `transformation`, `auth`, `health`, `ai`, `mcp` |

{{< reuse "agw-docs/pages/agentgateway/about/processing-order.md" >}}

## Policy targeting {#targeting}

Each policy section can only target specific Kubernetes resource types. If you set a `targetRef` or `targetSelector` to an invalid resource type for the policy section, the Kubernetes API server rejects the request with a validation error. Invalid targeting is **not** silently ignored.

{{< callout type="info">}}
A single {{< reuse "agw-docs/snippets/agentgateway/agentgatewaypolicy.md" >}} can only target one kind of resource. For example, you cannot target both a Gateway and an HTTPRoute in the same policy. All entries in `targetRefs` or `targetSelectors` must reference the same `kind`.
{{< /callout >}}

### Targeting rules

The following table shows which resource types each policy section can target.

| Policy section | Valid targets | sectionName | Notes |
| -- | -- | -- | -- |
| `frontend` | Gateway | Not allowed | Applies to all listeners on the targeted Gateway. |
| `traffic` | Gateway, HTTPRoute, GRPCRoute, ListenerSet | Optional | When targeting a Gateway, the `sectionName` selects a specific listener. When targeting an HTTPRoute or GRPCRoute, the `sectionName` selects a specific route rule. |
| `backend` | Gateway, HTTPRoute, GRPCRoute, ListenerSet, Service, {{< reuse "agw-docs/snippets/agentgateway/agentgatewaybackend.md" >}} | Optional | When targeting a Service, the `sectionName` selects a specific port. When targeting an {{< reuse "agw-docs/snippets/agentgateway/agentgatewaybackend.md" >}}, the `sectionName` selects a specific sub-backend. |

### Backend section restrictions

Some `backend` sub-fields have additional targeting restrictions.

| Field | Restriction |
| -- | -- |
| `backend.ai` | Cannot target a Service. Use an {{< reuse "agw-docs/snippets/agentgateway/agentgatewaybackend.md" >}} instead. |
| `backend.mcp` | Cannot target a Service. Use an {{< reuse "agw-docs/snippets/agentgateway/agentgatewaybackend.md" >}} instead. |

### Traffic phase restrictions

The `traffic` section supports an optional `phase` field that controls when the policy runs. When you set the phase to `PreRouting`, the policy runs before route selection. Because of this timing, `PreRouting` policies can only target a Gateway or ListenerSet.

For more information, see [Policy processing order](#processing-order) and [PreRouting filters](#prerouting-filters).

## Policy merging {#merging}

When multiple policies target the same resource, agentgateway merges the policy sections on a **field level** (shallow merge). If two policies set the same field, the more specific policy takes precedence.

### Merge precedence

Each policy section follows a different precedence order based on the specificity of the target. The more specific the target, the higher the precedence.

| Section | Precedence order (lowest to highest) |
| -- | -- |
| `frontend` | Field-level merge across policies that target the same Gateway. |
| `traffic` | Gateway < Listener < Route < Route rule |
| `backend` | Gateway < Listener < Route (targetRef) < Route rule (targetRef) < Backend (targetRef) < Backend (inline on the backend object) < Route backend ref (inline on the route) |

For example, if a Gateway-level policy sets `backend.tcp` and `backend.tls`, and a Backend-level policy sets `backend.tls`, the effective policy uses `tcp` from the Gateway policy and `tls` from the Backend policy.

## Example guides

Check out the following sections for policy examples.

{{< cards >}}
  {{< card path="/security" title="Security" >}}
  {{< card path="/traffic-management" title="Traffic management" >}}
  {{< card path="/resiliency" title="Resiliency" >}}
{{< /cards >}}
