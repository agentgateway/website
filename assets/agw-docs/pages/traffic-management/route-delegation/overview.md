Delegate routing decisions to another HTTPRoute resource.

## What is route delegation

As your environment grows, your gateways manage traffic for more and more routes. These routes typically belong to many apps, and different individuals or teams own them. Managing the routing rules for all of these routes can be cumbersome, and route updates can easily affect the behavior of other routes.

Route delegation lets you split up large, complex routing configurations into smaller configurations that are easier to maintain. You can then assign ownership for each smaller configuration to the team that owns the app or domain.

For example, assume you have three apps (`app-a`, `app-b`, and `app-c`) that three teams (`team-a`, `team-b`, and `team-c`) own. Instead of creating one routing configuration that includes the routing rules for all apps, you create a routing configuration for each app and delegate ownership to the team that owns the app. Each team can then further delegate routing decisions to other teams.

Each set of routing rules is defined in a dedicated HTTPRoute. These HTTPRoutes are organized into a routing hierarchy that consists of the following elements:

| Element | Resource | Description |
|---|---|---|
| Parent | HTTPRoute | The parent HTTPRoute specifies the main domain under which all routes in the parent, child, and grandchild HTTPRoutes are exposed. The parent HTTPRoute also references the Gateway that fulfills the routing configuration in the `parentRefs` section. To delegate traffic to a child HTTPRoute, the parent rule must use a `PathPrefix` matcher. |
| Child | HTTPRoute | The child HTTPRoute receives traffic from the parent HTTPRoute and either forwards traffic to a backing service or delegates further to a grandchild HTTPRoute. To receive delegated traffic, the child must match a path that contains the parent's prefix. For example, if the parent delegates traffic for `/route`, the child must define a route that includes that prefix, such as `/route/a`. To delegate further to a grandchild, the child rule must use a `PathPrefix` matcher. |
| Grandchild | HTTPRoute | A grandchild HTTPRoute receives traffic from a child HTTPRoute. It can be selected by any child that delegates to it. The grandchild must match a path that contains the prefix the child delegated for. For example, if the child delegates traffic for `/route/a`, the grandchild must match a path that includes that prefix, such as `/route/a/myservice`. Great-grandchild HTTPRoutes and beyond behave the same way. |

{{< callout type="info" >}}
For an example route delegation setup with a parent, child, and grandchild HTTPRoute, see [Multi-level delegation]({{< link-hextra path="/traffic-management/route-delegation/multi-level-delegation/" >}}).
{{< /callout >}}

## Benefits and use cases

Use route delegation as a security and risk-mitigation strategy. Route delegation lets multiple teams own, add, remove, and update routes on a gateway without affecting routing rules that other teams configured, and without requiring access to the entire routing configuration.

Review some of the benefits that you can achieve with route delegation:

| Benefit | Description |
|---|---|
| Organize routing rules by user groups | Break up large routing configurations into smaller configurations that are easier to maintain and assign ownership to. Each routing configuration in the hierarchy contains the routing rules and policies for only a subset of routes. |
| Restrict access to routing configuration | Because route delegation lets you break up large routing configurations into smaller, manageable pieces, you can assign ownership and restrict access to those smaller configurations to the individuals or teams that are responsible for a specific app or domain. For example, the network administrator can configure the top-level routing rules, such as the hostname and main route match, and delegate the individual routing rules to other teams. |
| Simplify blue-green route testing | To test a new routing configuration, delegate a specific portion of traffic to the new set of routes. |
| Optimize traffic flows | Distribute traffic load across multiple paths or nodes in the cluster to improve network performance and reliability. |
| Easier updates with limited blast radius | Individual teams can update the routing configuration for their apps and manage the policies for their routes. If an error is introduced, the blast radius is limited to the set of routes that were changed. |

## Policy inheritance

Review how policies are inherited along the route delegation chain.

For more information, see the [Policy inheritance]({{< link-hextra path="/traffic-management/route-delegation/inheritance/" >}}) guides.

### Native Gateway API policies

{{< reuse "agw-docs/snippets/policy-inheritance-native.md" >}}

### AgentgatewayPolicy resources

{{< reuse "agw-docs/snippets/policy-inheritance.md" >}}

## Automatic route replacement

If a destination defined in an HTTPRoute's `backendRefs` cannot be found, the route is automatically replaced with a 500 HTTP direct response. For example, this replacement happens when a parent HTTPRoute routes traffic to a child HTTPRoute that does not exist. Other valid routes are not replaced and continue to work.

## Limitations

The route delegation model imposes a few restrictions. If a rule is violated, the corresponding rule is removed from the route.

### Hostnames

Only parent HTTPRoutes can specify the `spec.hostnames` field. All child and grandchild HTTPRoutes inherit the parent's hostname.

### Route matchers

A parent HTTPRoute that delegates to child HTTPRoutes _must_ use `PathPrefix` matchers, as shown in the following example:

```yaml {filename="route-matcher-snippet.yaml"}
rules:
- matches:
  - path:
      type: PathPrefix
      value: /a
  backendRefs:
  - group: gateway.networking.k8s.io
    kind: HTTPRoute
    name: "*"
    namespace: abc
```

A child HTTPRoute can use prefix, exact, or regex path matchers in its rules, as shown in the following example. Each path matcher must start with the prefix that the parent HTTPRoute delegates traffic for, in this case `/a`. The child HTTPRoute defines three route matchers along the `/a` path: `/1`, `/1/foo`, and `/1/.*`.

```yaml {filename="route-matcher-snippet.yaml"}
rules:
- matches:
  - path:
      type: PathPrefix
      value: /a/1
  - path:
      type: Exact
      value: /a/1/foo
  - path:
      type: RegularExpression
      value: /a/1/.*
  backendRefs:
  - name: svc-a
    port: 8080
```

{{< callout type="info" >}}
If a child HTTPRoute delegates routing decisions to a grandchild, the rule that delegates _must_ use a `PathPrefix` matcher. For an example of route delegation between a parent, child, and grandchild HTTPRoute, see [Multi-level delegation]({{< link-hextra path="/traffic-management/route-delegation/multi-level-delegation/" >}}).
{{< /callout >}}

### Headers, query parameters, HTTP methods

You can specify headers, query parameters, and HTTP method matchers on both parent and child HTTPRoutes. The parent's matchers control which requests are delegated, and the child's matchers independently control which delegated requests are routed to a backend. A request must satisfy both the parent's and the child's matchers to reach a backend service.

The parent and child can define different sets of header and query parameter matchers. For example, a parent might delegate traffic that includes `header1: val1`, while the child matches on `headerX: valX`. In this case, a request must include both `header1` and `headerX` to reach the backend: `header1` so the parent delegates the request, and `headerX` so the child routes it.

{{< callout type="info" >}}
For an example route delegation setup that uses headers and query parameters, see [Header and query match]({{< link-hextra path="/traffic-management/route-delegation/header-query/" >}}).
{{< /callout >}}

### Multiple parent HTTPRoutes

Any parent HTTPRoute whose `backendRefs` matches the child's namespace plus the child's name can delegate to a child HTTPRoute. Wildcard `*` names and `<key>=<value>` label selectors also match.

The `parentRefs` field on a child HTTPRoute is **informational only** for delegation. The agentgateway controller uses `parentRefs` to decide which parent to report status against, but `parentRefs` does not gate which parents may delegate to the child. Any parent that matches by namespace and name (or label) can delegate to the child, even if that parent is not listed in the child's `parentRefs`.

To scope a child HTTPRoute to specific parents, use one of the following patterns instead.

* Place children in different namespaces, and have each parent delegate to a different namespace.
* Use distinct labels on each child and select them with `<key>=<value>` syntax in the parent's `backendRefs.name`. For an example, see [Delegation via labels]({{< link-hextra path="/traffic-management/route-delegation/label/" >}}).

### Cyclic delegation

Agentgateway does not allow cyclic route delegation, such as HTTPRoute A delegates to B, B delegates to C, and C delegates back to A. No proper backend in the cycle fulfills the request. When agentgateway detects cyclic route delegation, the route in the cycle is automatically replaced with a 500 HTTP direct response.
