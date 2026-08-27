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

Use the `port` field to scope a `frontend` policy to a single listener port on the Gateway. Whether a `frontend` policy can also set a `sectionName` to scope the policy to a single named listener depends on which fields the policy sets.

| Fields | `sectionName` |
| -- | -- |
| `accessLog`, `metrics`, `tracing` | Allowed. Selects a single listener. |
| `connect`, `http`, `networkAuthorization`, `proxyProtocol`, `tcp`, `tls` | Not allowed. |

If a policy sets any not allowed field, the Kubernetes API server rejects the `sectionName` on that policy.

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

### Inline AI policies on a backend {#backend-ai}

An {{< reuse "agw-docs/snippets/backend.md" >}} can set an AI policy inline, in `spec.ai.groups[].providers[].policies.ai`. An {{< reuse "agw-docs/snippets/policy.md" >}} can set one in `spec.backend.ai` and attach it to the same backend. The two policies merge field by field, the same as any other pair of policies. For a field that both of them set, the inline value wins, because a policy inline on the backend object is more specific than an attached policy. For the full order, see [Merge precedence](#merging-precedence).

The following fields of `ai` each merge separately: `defaults`, `finalTransformations`, `modelAliases`, `overrides`, `prompt`, `promptCaching`, `promptGuard`, `routes`, and `transformations`.

> [!IMPORTANT]
> In version 1.4 and earlier, an inline `ai` block replaced an attached `ai` block in full. If the backend set even one field of `ai`, every field of the attached policy was dropped. After you upgrade to version 1.5, a field that only the {{< reuse "agw-docs/snippets/policy.md" >}} sets takes effect where it was previously ignored, which can turn on a prompt guard, a default, or a transformation that had no effect before. Review each {{< reuse "agw-docs/snippets/backend.md" >}} that sets an inline `ai` block alongside an attached policy, and remove any field from the {{< reuse "agw-docs/snippets/policy.md" >}} that you do not want the backend to inherit.

### Merge precedence {#merging-precedence}

Conditional policies are selected first based on their conditions. Only the selected policies participate in merge precedence evaluation.

Each policy section follows a different precedence order based on the specificity of the target. The more specific the target, the higher the precedence. In the following table, `<` shows which policies override others. For example, `A < B` means a policy attached at `B` overrides a matching field set by a policy attached at `A`.

| Section | Precedence order (lowest to highest) |
| -- | -- |
| `frontend` | Gateway < Port < Listener |
| `traffic` | Gateway < Listener < Route < Route rule |
| `backend` | Gateway < Listener < Route (targetRef) < Route rule (targetRef) < Backend (targetRef) < Backend (inline on the backend object) < Route backend ref (inline on the route) |

For a `frontend` policy, you can only apply the policy at the Listener level when the `frontend` policy field supports setting a `sectionName`. For more information about the fields that support the `sectionName` setting, see [Frontend section restrictions](#frontend-restrictions).

For `backend`, precedence works the same way but with more levels. For example, if a Gateway-level policy sets `backend.tcp` and `backend.tls`, and a Backend-level policy sets `backend.tls`, the effective policy uses `tcp` from the Gateway policy and `tls` from the Backend policy.

### Equal specificity {#ties}

If multiple policies with the same specificity set the same field, agentgateway picks one policy's value for that field and silently drops the rest. The selection isn't based on creation time, name, or namespace, so which policy wins isn't predictable and can change between controller restarts. Every affected policy still reports `Accepted` and `Attached` status conditions as `True`, with no condition indicating that a field was dropped.

A tie only happens when two policies share both the same specificity and the same field. You can attach multiple policies to the same target as long as each one sets a different field, or attaches at a different specificity level. For example, a `frontend` policy that sets `tls` at the Gateway level and another that sets `accessLog` using a listener `sectionName` don't tie, because they set different fields. A `frontend` policy that sets `tls` at the Gateway level and another that sets `tls` using `port` also don't tie, because `port` is more specific and wins for that field.

A tie is easiest to hit with `frontend`, because a `frontend` policy has at most three specificity levels: the Gateway, an optional `port`, and an optional listener `sectionName` for the fields where `sectionName` is allowed. Two policies that both target only the Gateway have no way to differentiate their specificity.

To avoid a tie, set a given field or section in only one policy per target.

## Merge strategy overrides for traffic policies {#strategy}

`AgentgatewayPolicy.spec.strategy.inheritance` changes how `traffic` policies merge. It's valid only on policies that set `traffic`. The Kubernetes API server rejects a policy that sets the `inheritance` block alongside the `frontend` or `backend` block. Frontend and backend policy merging always follows the `frontend` and `backend` precedence orders in the [Merge precedence](#merging-precedence) table and never uses `inheritance`.

The following `inheritance` values are supported for `traffic` policies:

| Value | Behavior |
| -- | -- |
| `Default` | The default value. Fields from more-specific attachment points, such as routes and route rules, can override fields from less-specific attachment points, such as gateways and listeners. Use this value to set a `traffic` default at the Gateway that specific routes can override. |
| `Override` | Blocks `traffic` policies at more-specific attachment points from contributing to the effective policy. Use this value when a less-specific policy, such as one at the Gateway level, must stay authoritative for everything below it. The less-specific policy is the one that overrides, not the one being overridden: a Gateway-level `traffic` policy with `inheritance: Override` locks its fields so that policies attached at more-specific points, such as routes or route rules, can't replace them. |