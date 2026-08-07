---
title: Targeting and merging
weight: 10
description: Learn how to target and merge policies when multiple policies apply to the same resource.
test: skip
---

## Policy targeting {#targeting}

Each policy section can only target specific Kubernetes resource types. If you set a `targetRef` or `targetSelector` to an invalid resource type for the policy section, the Kubernetes API server rejects the request with a validation error. Invalid targeting is **not** silently ignored.

> [!NOTE]
> A single {{< reuse "agw-docs/snippets/policy.md" >}} can only target one kind of resource. For example, you cannot target both a Gateway and an HTTPRoute in the same policy. All entries in `targetRefs` or `targetSelectors` must reference the same `kind`.

### Targeting rules

The following table shows which resource types each policy section can target.

| Policy section | Valid targets | sectionName | Notes |
| -- | -- | -- | -- |
| `frontend` | Gateway | Depends on the field. See [Frontend section restrictions](#frontend-restrictions) for more information. | Applies to all listeners on the targeted Gateway. A `targetRef` or `targetSelector` can also set `port` to scope the policy to a single listener port on the Gateway. |
| `traffic` | Gateway, HTTPRoute, GRPCRoute, ListenerSet | Optional | When targeting a Gateway, the `sectionName` selects a specific listener. When targeting an HTTPRoute or GRPCRoute, the `sectionName` selects a specific route rule. |
| `backend` | Gateway, HTTPRoute, GRPCRoute, ListenerSet, Service, {{< reuse "agw-docs/snippets/backend.md" >}} | Optional | When targeting a Service, the `sectionName` selects a specific port. When targeting an {{< reuse "agw-docs/snippets/backend.md" >}}, the `sectionName` selects a specific sub-backend. |

### Frontend section restrictions {#frontend-restrictions}

Use `port` to scope a `frontend` policy to a single listener port on the Gateway, which is allowed for every `frontend` field. Whether a `frontend` policy can also set `sectionName` to scope the policy to a single named listener depends on which fields the policy sets.

| Fields | `sectionName` |
| -- | -- |
| `accessLog`, `metrics`, `tracing` | Allowed. Selects a single listener. |
| `connect`, `http`, `networkAuthorization`, `proxyProtocol`, `tcp`, `tls` | Not allowed. |

If a policy sets any not allowed field, the Kubernetes API server rejects `sectionName` on that policy, even if the policy also sets an allowed field.

### Backend section restrictions

Some `backend` sub-fields have additional targeting restrictions.

| Field | Restriction |
| -- | -- |
| `backend.ai` | Cannot target a Service. Use an {{< reuse "agw-docs/snippets/backend.md" >}} instead. |
| `backend.mcp` | Cannot target a Service. Use an {{< reuse "agw-docs/snippets/backend.md" >}} instead. |

### Traffic phase restrictions

The `traffic` section supports an optional `phase` field that controls when the policy runs. When you set the phase to `PreRouting`, the policy runs before route selection. Because of this timing, `PreRouting` policies can only target a Gateway or ListenerSet.

For more information, see [Policy processing order](../filter-order/#processing-order) and [PreRouting filters](../filter-order/#prerouting).

## Policy merging {#merging}

When multiple policies target the same resource, agentgateway merges the policy sections on a **field level** (shallow merge). Each field is treated as an atomic unit. If two policies set the same field, the more specific policy takes precedence.

This field-level merge applies to all fields, including nested sub-fields. Each nested sub-field is treated as an atomic unit. For example, `backend.ai.promptGuard` and `backend.ai.routes` are separate atomic fields. If Policy A sets `backend.ai.promptGuard` and Policy B sets `backend.ai.routes`, both are included in the merged result. However, if both policies set the same nested sub-field such as `backend.ai.promptGuard`, only the higher-precedence policy's entire value for that sub-field is used—no recursive merge occurs within nested fields.

### Merge precedence {#merging-precedence}

Conditional policies are selected first based on their conditions. Only the selected policies participate in merge precedence evaluation.

Each policy section follows a different precedence order based on the specificity of the target. The more specific the target, the higher the precedence. In the following table, `A < B` means a policy attached at `B` overrides a matching field set by a policy attached at `A`.

| Section | Precedence order (lowest to highest) |
| -- | -- |
| `frontend` | Gateway < Port < Listener |
| `traffic` | Gateway < Listener < Route < Route rule |
| `backend` | Gateway < Listener < Route (targetRef) < Route rule (targetRef) < Backend (targetRef) < Backend (inline on the backend object) < Route backend ref (inline on the route) |

For `frontend`, the Listener level applies only to `sectionName`. Only some `frontend` fields allow `sectionName` at all. See [Frontend section restrictions](#frontend-restrictions) for which ones.

For example, if a Gateway-level policy sets `backend.tcp` and `backend.tls`, and a Backend-level policy sets `backend.tls`, the effective policy uses `tcp` from the Gateway policy and `tls` from the Backend policy.

### When two policies have equal specificity {#ties}

If multiple policies with the same specificity set the same field, agentgateway picks one policy's value for that field and silently drops the rest. The selection isn't based on creation time, name, or namespace, so which policy wins isn't predictable and can change between controller restarts. Every affected policy still reports `Accepted` and `Attached` status conditions as `True`, with no condition indicating that a field was dropped.

This applies to every policy section, but it's easiest to hit with `frontend`. A `frontend` policy has at most three specificity levels: the Gateway, an optional `port`, and an optional listener `sectionName` for the fields where `sectionName` is allowed. Two policies that both target only the Gateway have no way to differentiate their specificity.

To avoid this, set a given field or section in only one policy per target.

## Merge strategy overrides {#strategy}

`AgentgatewayPolicy.spec.strategy.inheritance` changes how `traffic` policies merge. It's valid only on policies that set `traffic`. The Kubernetes API server rejects a policy that sets `inheritance` alongside `frontend` or `backend`. Frontend and backend policy merging always follows the specificity order described above and doesn't use `inheritance`.

| Value | Behavior |
| -- | -- |
| `Default` | The default value. Fields from more-specific attachment points, such as routes and route rules, can override fields from less-specific attachment points, such as gateways and listeners. Use this to set a `traffic` default at the Gateway that specific routes can override. |
| `Override` | Blocks `traffic` policies at more-specific attachment points from contributing to the effective policy. Use this when a less-specific policy, such as one at the Gateway level, must stay authoritative for everything below it. |