---
title: Route delegation
weight: 15
description: Delegate routing decisions to route groups so that different teams can independently manage their own routes.
---

Delegate routing decisions from a parent route to a set of child routes defined in a route group. Route delegation lets you break up large routing configurations into smaller, independently managed pieces.

## About

As your gateway manages traffic for more routes, managing all routing rules in a single configuration becomes difficult. Route delegation lets you split routing configurations so that different teams can own their routes independently.

In standalone mode, route delegation uses **route groups**. A parent route references a route group as its backend, and the route group contains child routes that handle more specific paths within the parent's prefix.

| Element | Description |
|---|---|
| **Parent route** | A route defined on a listener. Instead of routing directly to a backend, it references a `routeGroup` in its `backends` list. The parent must use a `pathPrefix` matcher. |
| **Route group** | Defined at the top level under `routeGroups`. Contains a `name` and a list of child `routes`. |
| **Child route** | A route inside a route group. Uses the same matching logic as regular routes (path, headers, query parameters). The child's path must fall within the parent's prefix to be reachable. |

### Example request flow

```
Request: /anything/team1/foo
         |
         v
   Parent Route (matches /anything/team1)
         |
         | delegates to routeGroup: team1-routes
         v
   Route Group "team1-routes"
         |
         | selects best matching child route
         v
   Child Route "child-foo" (matches /anything/team1/foo)
         |
         v
   Backend: team1-foo.example.com:8080
```

### More details

Review more details about how route delegation works in standalone mode.

| Area | Description |
|---|---|
| Parent path matcher | A parent route that delegates to a route group must use a `pathPrefix` matcher. |
| Child path scope | Child routes must match a path that falls within the parent's prefix. For example, if the parent matches `/api`, a child must match a path starting with `/api`. |
| Cyclic delegation | Agentgateway does not allow cyclic delegation. If route group A delegates to B, and B delegates back to A, agentgateway detects the cycle at runtime and returns an error. |
| Missing route group | If a route references a `routeGroup` that does not exist, the route is replaced with a 500 HTTP response. |

## Before you begin

{{< reuse "agw-docs/snippets/prereq-agentgateway.md" >}}

## Basic delegation

Delegate traffic from a parent route to a route group with two child routes.

In this example, a parent route matches the `/anything/team1` prefix and delegates to a route group called `team1-routes`. The route group contains two child routes: `child-foo` matches `/anything/team1/foo` and `child-bar` matches `/anything/team1/bar`.

1. Create the configuration file.

   ```sh
   cat > config.yaml <<'EOF'
   # yaml-language-server: $schema=https://agentgateway.dev/schema/config
   binds:
   - port: 3000
     listeners:
     - protocol: HTTP
       routes:
       - name: parent-team1
         matches:
         - path:
             pathPrefix: /anything/team1
         backends:
         - routeGroup: team1-routes

   routeGroups:
   - name: team1-routes
     routes:
     - name: child-foo
       matches:
       - path:
           pathPrefix: /anything/team1/foo
       backends:
       - host: team1-foo.example.com:8080
     - name: child-bar
       matches:
       - path:
           pathPrefix: /anything/team1/bar
       backends:
       - host: team1-bar.example.com:8080
   EOF
   ```

2. Run the gateway.

   ```sh
   agentgateway -f config.yaml
   ```

3. Test the routes.

   ```sh
   # Matches parent -> delegates to team1-routes -> matches child-foo
   curl -i 127.0.0.1:3000/anything/team1/foo

   # Matches parent -> delegates to team1-routes -> matches child-bar
   curl -i 127.0.0.1:3000/anything/team1/bar

   # Matches parent prefix, but no child route matches -> 404
   curl -i 127.0.0.1:3000/anything/team1/other

   # Does not match parent prefix -> 404
   curl -i 127.0.0.1:3000/other
   ```

## Header and query matching

Parent routes can include header and query parameter matchers that control which requests are delegated. Child routes can independently define their own matchers. A request must satisfy both the parent's and the child's matchers to reach a backend.

In this example, a parent route matches `/anything/team1` only when the `x-team` header and `env` query parameter are present. The route group has two child routes:

* `child-foo` adds its own header matcher (`x-role`) beyond what the parent requires. A request must include both the parent's and child's matchers to reach the backend.
* `child-bar` matches on path only, with no additional header or query parameter matchers. Any request that the parent delegates is routed if the path matches.

1. Create the configuration file.

   ```sh
   cat > config.yaml <<'EOF'
   # yaml-language-server: $schema=https://agentgateway.dev/schema/config
   binds:
   - port: 3000
     listeners:
     - protocol: HTTP
       routes:
       - name: parent-team1
         matches:
         - path:
             pathPrefix: /anything/team1
           headers:
           - name: x-team
             value:
               exact: team1
           query:
           - name: env
             value:
               exact: prod
         backends:
         - routeGroup: team1-routes

   routeGroups:
   - name: team1-routes
     routes:
     - name: child-foo
       matches:
       - path:
           pathPrefix: /anything/team1/foo
         headers:
         - name: x-role
           value:
             exact: admin
       backends:
       - host: team1-foo.example.com:8080
     - name: child-bar
       matches:
       - path:
           pathPrefix: /anything/team1/bar
       backends:
       - host: team1-bar.example.com:8080
   EOF
   ```

2. Run the gateway.

   ```sh
   agentgateway -f config.yaml
   ```

3. Test the routes.

   ```sh
   # child-foo: parent matchers + child's x-role header -> 200
   curl -i "127.0.0.1:3000/anything/team1/foo?env=prod" \
     -H "x-team: team1" -H "x-role: admin"

   # child-foo: parent matchers only, missing child's x-role -> 404
   curl -i "127.0.0.1:3000/anything/team1/foo?env=prod" \
     -H "x-team: team1"

   # child-bar: parent matchers, child matches on path only -> 200
   curl -i "127.0.0.1:3000/anything/team1/bar?env=prod" \
     -H "x-team: team1"

   # child-bar: missing parent matchers, not delegated -> 404
   curl -i 127.0.0.1:3000/anything/team1/bar
   ```

## Multi-level delegation

Child routes inside a route group can delegate to other route groups, creating a multi-level delegation hierarchy. Agentgateway detects cycles at runtime and returns an error if a delegation chain loops back to a previously visited route group.

In this example, a parent route delegates `/api` to a route group. One child handles `/api/users` directly, while another child delegates `/api/orders` to a second route group with more specific routes.

1. Create the configuration file.

   ```sh
   cat > config.yaml <<'EOF'
   # yaml-language-server: $schema=https://agentgateway.dev/schema/config
   binds:
   - port: 3000
     listeners:
     - protocol: HTTP
       routes:
       - name: parent-api
         matches:
         - path:
             pathPrefix: /api
         backends:
         - routeGroup: api-routes

   routeGroups:
   - name: api-routes
     routes:
     - name: child-users
       matches:
       - path:
           pathPrefix: /api/users
       backends:
       - host: users-service.example.com:8080
     - name: child-orders
       matches:
       - path:
           pathPrefix: /api/orders
       backends:
       - routeGroup: orders-routes
   - name: orders-routes
     routes:
     - name: grandchild-list
       matches:
       - path:
           pathPrefix: /api/orders/list
       backends:
       - host: orders-list.example.com:8080
     - name: grandchild-detail
       matches:
       - path:
           pathPrefix: /api/orders/detail
       backends:
       - host: orders-detail.example.com:8080
   EOF
   ```

2. Run the gateway.

   ```sh
   agentgateway -f config.yaml
   ```

3. Test the routes.

   ```sh
   # Parent -> api-routes -> child-users (direct backend)
   curl -i 127.0.0.1:3000/api/users

   # Parent -> api-routes -> child-orders -> orders-routes -> grandchild-list
   curl -i 127.0.0.1:3000/api/orders/list

   # Parent -> api-routes -> child-orders -> orders-routes -> grandchild-detail
   curl -i 127.0.0.1:3000/api/orders/detail

   # Matches child-orders prefix, but no grandchild matches -> 404
   curl -i 127.0.0.1:3000/api/orders/other
   ```

## Policy inheritance

Policies defined on a parent route are inherited by child routes in the delegation chain. If a child route defines the same type of policy, the child's policy takes precedence.

In this example, a parent route sets a `requestHeaderModifier` policy that adds an `x-parent` header to all requests. One child route inherits this policy, while the other overrides it with its own `requestHeaderModifier` that adds a different header instead.

1. Create the configuration file.

   ```sh
   cat > config.yaml <<'EOF'
   # yaml-language-server: $schema=https://agentgateway.dev/schema/config
   binds:
   - port: 3000
     listeners:
     - protocol: HTTP
       routes:
       - name: parent-team1
         matches:
         - path:
             pathPrefix: /anything/team1
         policies:
           requestHeaderModifier:
             add:
               x-parent: from-parent
         backends:
         - routeGroup: team1-routes

   routeGroups:
   - name: team1-routes
     routes:
     - name: child-inherits
       matches:
       - path:
           pathPrefix: /anything/team1/foo
       backends:
       - host: team1-foo.example.com:8080
     - name: child-overrides
       matches:
       - path:
           pathPrefix: /anything/team1/bar
       policies:
         requestHeaderModifier:
           add:
             x-child: from-child
       backends:
       - host: team1-bar.example.com:8080
   EOF
   ```

2. Run the gateway.

   ```sh
   agentgateway -f config.yaml
   ```

3. Test the routes.

   ```sh
   # child-inherits: receives x-parent header from parent policy
   curl -i 127.0.0.1:3000/anything/team1/foo

   # child-overrides: receives x-child header; parent's requestHeaderModifier is overridden
   curl -i 127.0.0.1:3000/anything/team1/bar
   ```
