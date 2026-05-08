## Conditional policies

A policy normally applies the same configuration to every request on the route it attaches to. Conditional execution lets you nest a list of policy variants under a `conditional` field. Each variant has a {{< gloss "CEL (Common Expression Language)" >}}CEL{{< /gloss >}} expression that determines whether it applies. For each request, agentgateway evaluates the entries in order and runs the first variant whose expression returns `true`.

A common use case is choosing between two external authorization servers based on the request. For example, you might send admin paths to a stricter authorization server and route everything else to a standard one.

The following policies support conditional execution:

- External authorization (`extAuth`).
- External processing (`extProc`).
- Rate limiting (`rateLimit`).
- Transformations (`transformation`).
- Direct response (`directResponse`).

For details on how to write the CEL expressions that go in each `condition` field, see the [CEL expressions reference]({{< link-hextra path="/reference/cel" >}}).

### How conditional execution works {#how-it-works}

- **First match wins.** Agentgateway evaluates each `conditional` entry in the order you list them and runs the first variant whose `condition` evaluates to `true`. Subsequent entries are not evaluated.
- **Optional fallback.** An entry without a `condition` is the unconditional fallback. It must be the last entry in the list, and you can have at most one. If no condition matches and there is no fallback, the policy does not run for that request.
- **Mutually exclusive with the inline form.** For a given policy, set either the top-level fields or the `conditional` list, not both.
- **Limits.** {{< conditional-text include-if="kubernetes" >}}A `conditional` list can have between 1 and 16 entries.{{< /conditional-text >}}{{< conditional-text include-if="standalone" >}}A `conditional` list can have between 1 and 64 entries.{{< /conditional-text >}}

### Examples

Review the following examples to see how conditional policies work. Conditional execution works the same way for every supported policy. The following examples show one configuration per policy type.

#### Multiple ext auth servers {#example-extauth}

Route to one of two external authorization servers based on the request path. Requests to a path that starts with `/admin` go to a stricter authorization server. The fallback entry handles every other request.

{{< conditional-text include-if="standalone" >}}
```yaml
# yaml-language-server: $schema=https://agentgateway.dev/schema/config
binds:
- port: 3000
  listeners:
  - routes:
    - backends:
      - host: localhost:8000
      policies:
        extAuthz:
          conditional:
          # Admin paths go to the stricter authorization server.
          - condition: request.path.startsWith("/admin")
            host: localhost:9000
            protocol:
              grpc: {}
            failureMode: deny
          # Fallback for every other request. No condition, must be last.
          - host: localhost:9001
            protocol:
              grpc: {}
            failureMode: deny
```
{{< /conditional-text >}}

{{< conditional-text include-if="kubernetes" >}}
```yaml
apiVersion: agentgateway.dev/v1alpha1
kind: AgentgatewayPolicy
metadata:
  name: conditional-extauth
  namespace: default
spec:
  targetRefs:
  - group: gateway.networking.k8s.io
    kind: HTTPRoute
    name: my-route
  traffic:
    extAuth:
      conditional:
      # Admin paths go to the stricter authorization server.
      - condition: request.path.startsWith("/admin")
        policy:
          backendRef:
            name: auth-strict
            port: 9000
          grpc: {}
          failureMode: FailClosed
      # Fallback for every other request. No condition, must be last.
      - policy:
          backendRef:
            name: auth-standard
            port: 9000
          grpc: {}
          failureMode: FailClosed
```
{{< /conditional-text >}}

#### Different rate limits {#example-ratelimit}

Apply a stricter rate limit to write requests and a looser limit to all other traffic.

{{< conditional-text include-if="standalone" >}}
```yaml
binds:
- port: 3000
  listeners:
  - routes:
    - backends:
      - host: localhost:8000
      policies:
        localRateLimit:
          conditional:
          - condition: request.method == "POST" || request.method == "PUT" || request.method == "DELETE"
            maxTokens: 10
            tokensPerFill: 10
            fillInterval: 1m
            type: requests
          - maxTokens: 100
            tokensPerFill: 100
            fillInterval: 1m
            type: requests
```
{{< /conditional-text >}}

{{< conditional-text include-if="kubernetes" >}}
```yaml
apiVersion: agentgateway.dev/v1alpha1
kind: AgentgatewayPolicy
metadata:
  name: conditional-ratelimit
  namespace: default
spec:
  targetRefs:
  - group: gateway.networking.k8s.io
    kind: HTTPRoute
    name: my-route
  traffic:
    rateLimit:
      conditional:
      - condition: request.method == "POST" || request.method == "PUT" || request.method == "DELETE"
        policy:
          local:
          - requests: 10
            unit: Minutes
      - policy:
          local:
          - requests: 100
            unit: Minutes
```
{{< /conditional-text >}}

#### Transform internal traffic {#example-transformation}

Add a tracing header when the request includes an `x-internal: true` header. With no fallback entry, agentgateway skips the transformation on every other request.

{{< conditional-text include-if="standalone" >}}
```yaml
binds:
- port: 3000
  listeners:
  - routes:
    - backends:
      - host: localhost:8000
      policies:
        transformations:
          conditional:
          - condition: request.headers["x-internal"] == "true"
            request:
              add:
                x-trace-source: '"internal"'
```
{{< /conditional-text >}}

{{< conditional-text include-if="kubernetes" >}}
```yaml
apiVersion: agentgateway.dev/v1alpha1
kind: AgentgatewayPolicy
metadata:
  name: conditional-transform
  namespace: default
spec:
  targetRefs:
  - group: gateway.networking.k8s.io
    kind: HTTPRoute
    name: my-route
  traffic:
    transformation:
      conditional:
      - condition: request.headers["x-internal"] == "true"
        policy:
          request:
            add:
            - name: x-trace-source
              value: '"internal"'
```
{{< /conditional-text >}}

#### Filter LLM chats with extproc {#example-extproc}

Send requests on a path that starts with `/v1/chat` through an external processor. Every other request bypasses the processor.

{{< conditional-text include-if="standalone" >}}
```yaml
binds:
- port: 3000
  listeners:
  - routes:
    - backends:
      - host: localhost:8000
      policies:
        extProc:
          conditional:
          - condition: request.path.startsWith("/v1/chat")
            host: localhost:9100
            failureMode: failClosed
```
{{< /conditional-text >}}

{{< conditional-text include-if="kubernetes" >}}
```yaml
apiVersion: agentgateway.dev/v1alpha1
kind: AgentgatewayPolicy
metadata:
  name: conditional-extproc
  namespace: default
spec:
  targetRefs:
  - group: gateway.networking.k8s.io
    kind: HTTPRoute
    name: my-route
  traffic:
    extProc:
      conditional:
      - condition: request.path.startsWith("/v1/chat")
        policy:
          backendRef:
            name: content-filter
            port: 9100
```
{{< /conditional-text >}}

#### Short-circuit deprecated paths with a direct response {#example-direct-response}

Return a `410 Gone` response for any path that starts with `/v0/`. Every other request proceeds to the backend.

{{< conditional-text include-if="standalone" >}}
```yaml
binds:
- port: 3000
  listeners:
  - routes:
    - backends:
      - host: localhost:8000
      policies:
        directResponse:
          conditional:
          - condition: request.path.startsWith("/v0/")
            status: 410
            body: "This API version is no longer available. Use /v1/."
```
{{< /conditional-text >}}

{{< conditional-text include-if="kubernetes" >}}
```yaml
apiVersion: agentgateway.dev/v1alpha1
kind: AgentgatewayPolicy
metadata:
  name: conditional-direct-response
  namespace: default
spec:
  targetRefs:
  - group: gateway.networking.k8s.io
    kind: HTTPRoute
    name: my-route
  traffic:
    directResponse:
      conditional:
      - condition: request.path.startsWith("/v0/")
        policy:
          status: 410
          body: "This API version is no longer available. Use /v1/."
```
{{< /conditional-text >}}
