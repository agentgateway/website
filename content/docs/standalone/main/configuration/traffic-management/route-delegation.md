---
title: Route delegation
weight: 15
description: Delegate routing decisions to route groups for independent team management.
test:
  route-delegation:
  - file: ${versionRoot}/configuration/traffic-management/route-delegation.md
    path: route-delegation
---

{{< doc-test paths="route-delegation" >}}
# ============================================================================
# Doc test coverage for this guide (these comments are not rendered on the page)
# ============================================================================
# WHAT THIS TEST VALIDATES:
#   * All four example configs are accepted by agentgateway (--validate-only),
#     covering `backends[].routeGroup`, top-level `routeGroups[].routes[]`, nested
#     route groups, and `policies` on both a parent and a child route.
#   * "Basic delegation" step 3: each of the four documented requests gets the
#     documented outcome. The two paths that match a child are delegated (503,
#     because the example backend hosts are placeholders), and the two that match
#     no child return 404. This is the "Child path scope" rule from the details
#     table made observable.
#   * "Header and query matching" step 3: all four documented cases, including
#     that a request satisfying the parent's matchers but missing the child's
#     `x-role` header is NOT delegated (404), which is the page's claim that a
#     request must satisfy both the parent's and the child's matchers.
#   * "Multi-level delegation" step 3: the two-level chain resolves
#     (parent -> api-routes -> child-orders -> orders-routes -> grandchild), and a
#     path matching the intermediate child but no grandchild returns 404.
#   * "Policy inheritance" step 3: a child with no policy of its own receives the
#     parent's `x-parent` request header, and the child that defines its own
#     `requestHeaderModifier` receives `x-child` and NOT `x-parent`. This confirms
#     the documented precedence rule ("the child's policy takes precedence").
#
# WHAT THIS TEST DOES NOT VALIDATE (and why):
#   * A successful response from any documented backend - requires config the page
#     omits; every example points at an unresolvable placeholder host
#     (team1-foo.example.com and friends), so a delegated request can only be
#     observed as a 503.
#   * The policy-inheritance assertion uses the page's config with the two
#     placeholder hosts swapped for a local echo backend, because inherited
#     request headers are only observable at the backend. That substitution is the
#     only place this test deviates from the page's configs.
#   * "Cyclic delegation" and "Missing route group" from the details table -
#     display-only table rows; the page ships no example config that creates a
#     cycle or a dangling routeGroup reference.
{{< reuse "agw-docs/snippets/install-agentgateway-binary.md" >}}

# Assert the HTTP status of one documented request. Extra args are passed to curl.
assert_status() {
  local desc="$1" expected="$2"; shift 2
  local got
  got=$(curl -s -o /dev/null -w '%{http_code}' --max-time 10 "$@")
  if [ "$got" != "$expected" ]; then
    echo "FAIL: $desc -- expected HTTP $expected but got $got"
    exit 1
  fi
  echo "✓ $desc -> $expected"
}

start_gateway() {
  agentgateway -f "${1:-config.yaml}" &
  AGW_PID=$!
  sleep 3
}

stop_gateway() {
  [ -n "${AGW_PID:-}" ] || return 0
  kill "$AGW_PID" 2>/dev/null || true
  wait "$AGW_PID" 2>/dev/null || true
  AGW_PID=""
}

trap 'stop_gateway; [ -n "${BACKEND_PID:-}" ] && kill "$BACKEND_PID" 2>/dev/null || true' EXIT
{{< /doc-test >}}

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

   ```sh {paths="route-delegation"}
   cat > config.yaml <<'EOF'
   # yaml-language-server: $schema=https://agentgateway.dev/schema/config
   gateways:
     default:
       port: 3000
       protocol: HTTP
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

   {{< doc-test paths="route-delegation" >}}
   # Basic delegation: validate the config written by step 1
   agentgateway -f config.yaml --validate-only
   {{< /doc-test >}}

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

{{< doc-test paths="route-delegation" >}}
start_gateway
assert_status "Basic: /anything/team1/foo is delegated to child-foo" 503 127.0.0.1:3000/anything/team1/foo
assert_status "Basic: /anything/team1/bar is delegated to child-bar" 503 127.0.0.1:3000/anything/team1/bar
assert_status "Basic: parent prefix with no matching child" 404 127.0.0.1:3000/anything/team1/other
assert_status "Basic: path outside the parent prefix" 404 127.0.0.1:3000/other
stop_gateway
{{< /doc-test >}}

## Header and query matching

Parent routes can include header and query parameter matchers that control which requests are delegated. Child routes can independently define their own matchers. A request must satisfy both the parent's and the child's matchers to reach a backend.

In this example, a parent route matches `/anything/team1` only when the `x-team` header and `env` query parameter are present. The route group has two child routes:

* `child-foo` adds its own header matcher (`x-role`) beyond what the parent requires. A request must include both the parent's and child's matchers to reach the backend.
* `child-bar` matches on path only, with no additional header or query parameter matchers. Any request that the parent delegates is routed if the path matches.

1. Create the configuration file.

   ```sh {paths="route-delegation"}
   cat > config.yaml <<'EOF'
   # yaml-language-server: $schema=https://agentgateway.dev/schema/config
   gateways:
     default:
       port: 3000
       protocol: HTTP
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

   {{< doc-test paths="route-delegation" >}}
   # Header and query matching: validate the config written by step 1
   agentgateway -f config.yaml --validate-only
   {{< /doc-test >}}

2. Run the gateway.

   ```sh
   agentgateway -f config.yaml
   ```

3. Test the routes.

   ```sh
   # child-foo: parent matchers + child's x-role header -> routed to child-foo
   curl -i "127.0.0.1:3000/anything/team1/foo?env=prod" \
     -H "x-team: team1" -H "x-role: admin"

   # child-foo: parent matchers only, missing child's x-role -> 404
   curl -i "127.0.0.1:3000/anything/team1/foo?env=prod" \
     -H "x-team: team1"

   # child-bar: parent matchers, child matches on path only -> routed to child-bar
   curl -i "127.0.0.1:3000/anything/team1/bar?env=prod" \
     -H "x-team: team1"

   # child-bar: missing parent matchers, not delegated -> 404
   curl -i 127.0.0.1:3000/anything/team1/bar
   ```

{{< doc-test paths="route-delegation" >}}
start_gateway
assert_status "Header/query: parent matchers plus the child's x-role is delegated" 503 \
  "127.0.0.1:3000/anything/team1/foo?env=prod" -H "x-team: team1" -H "x-role: admin"
assert_status "Header/query: parent matchers but missing the child's x-role" 404 \
  "127.0.0.1:3000/anything/team1/foo?env=prod" -H "x-team: team1"
assert_status "Header/query: child-bar matches on path only" 503 \
  "127.0.0.1:3000/anything/team1/bar?env=prod" -H "x-team: team1"
assert_status "Header/query: missing the parent's matchers is not delegated" 404 \
  127.0.0.1:3000/anything/team1/bar
stop_gateway
{{< /doc-test >}}

   The backend hosts in these examples are placeholders, so a request that is
   routed to a child returns `503` instead of a response from the backend. The
   `404` responses are the ones that show a request was not delegated.

## Multi-level delegation

Child routes inside a route group can delegate to other route groups, creating a multi-level delegation hierarchy. Agentgateway detects cycles at runtime and returns an error if a delegation chain loops back to a previously visited route group.

In this example, a parent route delegates `/api` to a route group. One child handles `/api/users` directly, while another child delegates `/api/orders` to a second route group with more specific routes.

1. Create the configuration file.

   ```sh {paths="route-delegation"}
   cat > config.yaml <<'EOF'
   # yaml-language-server: $schema=https://agentgateway.dev/schema/config
   gateways:
     default:
       port: 3000
       protocol: HTTP
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

   {{< doc-test paths="route-delegation" >}}
   # Multi-level delegation: validate the config written by step 1
   agentgateway -f config.yaml --validate-only
   {{< /doc-test >}}

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

{{< doc-test paths="route-delegation" >}}
start_gateway
assert_status "Multi-level: /api/users resolves through api-routes" 503 127.0.0.1:3000/api/users
assert_status "Multi-level: /api/orders/list resolves through two route groups" 503 127.0.0.1:3000/api/orders/list
assert_status "Multi-level: /api/orders/detail resolves through two route groups" 503 127.0.0.1:3000/api/orders/detail
assert_status "Multi-level: child-orders prefix with no matching grandchild" 404 127.0.0.1:3000/api/orders/other
stop_gateway
{{< /doc-test >}}

## Policy inheritance

Policies defined on a parent route are inherited by child routes in the delegation chain. If a child route defines the same type of policy, the child's policy takes precedence.

In this example, a parent route sets a `requestHeaderModifier` policy that adds an `x-parent` header to all requests. One child route inherits this policy, while the other overrides it with its own `requestHeaderModifier` that adds a different header instead.

1. Create the configuration file.

   ```sh {paths="route-delegation"}
   cat > config.yaml <<'EOF'
   # yaml-language-server: $schema=https://agentgateway.dev/schema/config
   gateways:
     default:
       port: 3000
       protocol: HTTP
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

   {{< doc-test paths="route-delegation" >}}
   # Policy inheritance: validate the config written by step 1
   agentgateway -f config.yaml --validate-only
   {{< /doc-test >}}

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

{{< doc-test paths="route-delegation" >}}
# Inherited request headers are only observable at the backend, so this assertion
# runs the page's config with the two placeholder hosts swapped for a local backend
# that echoes the request headers it received.
cat <<'PYEOF' > backend.py
from http.server import BaseHTTPRequestHandler, HTTPServer
import json

class Echo(BaseHTTPRequestHandler):
    def do_GET(self):
        body = json.dumps({k.lower(): v for k, v in self.headers.items()}).encode()
        self.send_response(200)
        self.send_header("content-type", "application/json")
        self.send_header("content-length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def log_message(self, *args):
        pass

HTTPServer(("127.0.0.1", 8081), Echo).serve_forever()
PYEOF
python3 backend.py &
BACKEND_PID=$!
for i in $(seq 1 30); do
  curl -sf -o /dev/null http://127.0.0.1:8081/ && break
  sleep 1
done

sed 's#team1-foo.example.com:8080#localhost:8081#; s#team1-bar.example.com:8080#localhost:8081#' \
  config.yaml > config-policy-local.yaml
start_gateway config-policy-local.yaml

INHERITS=$(curl -sf --max-time 10 127.0.0.1:3000/anything/team1/foo)
if [ "$(jq -r '."x-parent" // "absent"' <<<"$INHERITS")" != "from-parent" ]; then
  echo "FAIL: child-inherits did not receive the parent's x-parent header"
  echo "$INHERITS"
  exit 1
fi
echo "✓ Policy inheritance: child-inherits received x-parent from the parent route"

OVERRIDES=$(curl -sf --max-time 10 127.0.0.1:3000/anything/team1/bar)
if [ "$(jq -r '."x-child" // "absent"' <<<"$OVERRIDES")" != "from-child" ]; then
  echo "FAIL: child-overrides did not receive its own x-child header"
  echo "$OVERRIDES"
  exit 1
fi
if [ "$(jq -r '."x-parent" // "absent"' <<<"$OVERRIDES")" != "absent" ]; then
  echo "FAIL: child-overrides should override the parent policy, but x-parent was still added"
  echo "$OVERRIDES"
  exit 1
fi
echo "✓ Policy inheritance: child-overrides received x-child and not x-parent"
stop_gateway
{{< /doc-test >}}
