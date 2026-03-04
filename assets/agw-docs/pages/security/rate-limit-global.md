Apply distributed rate limits across multiple agentgateway replicas using an external rate limit service.

## About

Global rate limiting coordinates rate limits across multiple agentgateway proxy replicas using an external service that implements [Envoy's rate limit service protocol](https://www.envoyproxy.io/docs/envoy/latest/configuration/http/http_filters/rate_limit_filter). Unlike local rate limiting, which runs independently on each proxy replica, global rate limiting provides:

- **Shared counters** across all proxy replicas
- **Consistent enforcement** regardless of which replica receives the request
- **Descriptor-based limits** that can extract multiple request attributes using CEL expressions
- **Flexible targeting** by user, API key, IP address, path, or any combination

Global rate limiting is essential when running multiple proxy replicas and you need to enforce a single quota across the entire fleet — for example, "100 requests per minute per user" should apply to the sum of requests across all replicas, not 100 per replica.

### Request flow

Review the following sequence diagram to understand the request flow with global rate limiting.

```mermaid
sequenceDiagram
    participant Client
    participant Gateway
    participant RateLimiter
    participant App

    Client->>Gateway: 1. Send request to protected App
    Gateway->>Gateway: 2. Receive request
    Gateway->>RateLimiter: 3. Extract descriptors & send to Rate Limit Service
    RateLimiter->>RateLimiter: 4. Apply configured limits for descriptors
    RateLimiter->>Gateway: Return decision
    alt Request allowed
        Gateway->>App: 5. Forward request to App
        App->>Gateway: Return response
        Gateway->>Client: Return response to Client
    else Rate limit reached
        Gateway->>Client: 6. Deny request & return rate limit message
    end
```

1. The Client sends a request to an App protected by the Gateway.
2. The Gateway receives the request.
3. The Gateway evaluates the CEL expressions in the policy's descriptors to extract rate limit dimensions (e.g., client IP, user ID, path) and sends them to the Rate Limit Service via gRPC.
4. The Rate Limit Service checks its configuration for matching descriptors, applies the configured limits, and returns a decision.
5. If allowed, the Gateway forwards the request to the App.
6. If the rate limit is exceeded, the Gateway denies the request with a 429 response and rate limit headers.

### Architecture

Global rate limiting requires two components:

1. **{{< reuse "agw-docs/snippets/trafficpolicy.md" >}} with `rateLimit.global`**: Configure your rate limit policy with descriptors that extract request attributes using CEL expressions. The policy specifies:
   - `backendRef`: Reference to the rate limit service (Service or Backend)
   - `domain`: Arbitrary string identifying this application/team
   - `descriptors`: Array of CEL-based rules for extracting rate limit dimensions

2. **Rate Limit Service**: An external service implementing the Envoy Rate Limit gRPC protocol. The service:
   - Stores the actual rate limit values (requests per time unit)
   - Maintains counters in a backend store (typically Redis)
   - Returns allow/deny decisions based on descriptor matching

Unlike kgateway, agentgateway does **not** require a separate GatewayExtension resource — the policy directly references the rate limit service.

### Response headers

{{< reuse "agw-docs/snippets/ratelimit-headers.md" >}}

## Before you begin

{{< reuse "agw-docs/snippets/prereq-x-channel.md" >}}

## Deploy the rate limit service {#deploy-service}

You need an external rate limit service that implements the Envoy Rate Limit gRPC protocol. This example uses the reference implementation from Envoy with Redis as the backend store.

1. Create a namespace for the rate limit infrastructure.

   ```sh
   kubectl create namespace ratelimit
   ```

2. Deploy Redis as the backing store.

   ```yaml
   kubectl apply -f- <<EOF
   apiVersion: apps/v1
   kind: Deployment
   metadata:
     name: redis
     namespace: ratelimit
   spec:
     replicas: 1
     selector:
       matchLabels:
         app: redis
     template:
       metadata:
         labels:
           app: redis
       spec:
         containers:
           - name: redis
             image: redis:7-alpine
             ports:
               - containerPort: 6379
   ---
   apiVersion: v1
   kind: Service
   metadata:
     name: redis
     namespace: ratelimit
   spec:
     selector:
       app: redis
     ports:
       - port: 6379
   EOF
   ```

3. Create a ConfigMap with rate limit rules. This configuration defines the actual rate limits that will be enforced.

   ```yaml
   kubectl apply -f- <<EOF
   apiVersion: v1
   kind: ConfigMap
   metadata:
     name: ratelimit-config
     namespace: ratelimit
   data:
     config.yaml: |
       domain: api-gateway
       descriptors:
         # Rate limit by client IP: 10 requests per minute
         - key: remote_address
           rate_limit:
             unit: minute
             requests_per_unit: 10

         # Rate limit by path
         - key: path
           value: "/api/v1"
           rate_limit:
             unit: minute
             requests_per_unit: 100
         - key: path
           value: "/api/v2"
           rate_limit:
             unit: minute
             requests_per_unit: 200

         # Rate limit by user ID header
         - key: x-user-id
           rate_limit:
             unit: minute
             requests_per_unit: 50

         # Rate limit by user ID with specific value (VIP user)
         - key: x-user-id
           value: vip-user-123
           rate_limit:
             unit: minute
             requests_per_unit: 500

         # Generic service tier rate limit
         - key: service
           value: premium
           rate_limit:
             unit: minute
             requests_per_unit: 1000
         - key: service
           value: standard
           rate_limit:
             unit: minute
             requests_per_unit: 100
   EOF
   ```

   {{< reuse "agw-docs/snippets/review-table.md" >}}

   | Field | Description |
   |-------|-------------|
   | `domain` | Arbitrary identifier grouping rate limit rules. Multiple teams can use different domains to maintain separate configurations. Must match the `domain` in your {{< reuse "agw-docs/snippets/trafficpolicy.md" >}}. |
   | `descriptors` | Array of rate limit rules. Each descriptor matches against request attributes. |
   | `key` | The descriptor name. Must match the `name` field in the policy's descriptor entries. Case-sensitive. |
   | `value` | Optional. Enables fine-grained matching. For example, different rate limits for different paths or user IDs. |
   | `rate_limit` | The actual rate limit to enforce. |
   | `unit` | Time window: `second`, `minute`, `hour`, or `day`. |
   | `requests_per_unit` | Number of requests allowed per time window. |

4. Deploy the rate limit service.

   ```yaml
   kubectl apply -f- <<EOF
   apiVersion: apps/v1
   kind: Deployment
   metadata:
     name: ratelimit
     namespace: ratelimit
   spec:
     replicas: 1
     selector:
       matchLabels:
         app: ratelimit
     template:
       metadata:
         labels:
           app: ratelimit
       spec:
         containers:
           - name: ratelimit
             image: envoyproxy/ratelimit:master
             command: ["/bin/ratelimit"]
             env:
               - name: REDIS_SOCKET_TYPE
                 value: tcp
               - name: REDIS_URL
                 value: redis:6379
               - name: RUNTIME_ROOT
                 value: /data
               - name: RUNTIME_SUBDIRECTORY
                 value: ratelimit
               - name: RUNTIME_WATCH_ROOT
                 value: "false"
               - name: USE_STATSD
                 value: "false"
             ports:
               - containerPort: 8081
                 name: grpc
             volumeMounts:
               - name: config
                 mountPath: /data/ratelimit/config/config.yaml
                 subPath: config.yaml
         volumes:
           - name: config
             configMap:
               name: ratelimit-config
   ---
   apiVersion: v1
   kind: Service
   metadata:
     name: ratelimit
     namespace: ratelimit
   spec:
     selector:
       app: ratelimit
     ports:
       - name: grpc
         port: 8081
         targetPort: 8081
   EOF
   ```

5. Verify the rate limit service is running.

   ```sh
   kubectl get pods -n ratelimit
   ```

   Example output:

   ```
   NAME                         READY   STATUS    RESTARTS   AGE
   ratelimit-7b8f9c5d6d-x4k2m   1/1     Running   0          30s
   redis-5f6b8c7d9f-j8h5n       1/1     Running   0          45s
   ```

## Create a global rate limit policy {#create-policy}

Create an {{< reuse "agw-docs/snippets/trafficpolicy.md" >}} with `rateLimit.global` configured. The policy defines **which** request attributes to extract (via CEL expressions) and send to the rate limit service. The rate limit service decides **how many** requests to allow based on its configuration.

### Rate limit by client IP

Limit requests based on the client's source IP address.

```yaml
kubectl apply -f- <<EOF
apiVersion: {{< reuse "agw-docs/snippets/trafficpolicy-apiversion.md" >}}
kind: {{< reuse "agw-docs/snippets/trafficpolicy.md" >}}
metadata:
  name: ip-rate-limit
  namespace: httpbin
spec:
  targetRefs:
  - group: gateway.networking.k8s.io
    kind: HTTPRoute
    name: httpbin
  traffic:
    rateLimit:
      global:
        backendRef:
          name: ratelimit
          namespace: ratelimit
          port: 8081
        domain: api-gateway
        descriptors:
          - entries:
              - name: remote_address
                expression: "source.address"
EOF
```

{{< reuse "agw-docs/snippets/review-table.md" >}}

| Field | Required | Description |
|-------|----------|-------------|
| `backendRef` | Yes | Reference to the rate limit service. Supports `Service` or `Backend` kind. |
| `backendRef.name` | Yes | Name of the Service or Backend. |
| `backendRef.namespace` | Yes | Namespace where the service lives. |
| `backendRef.port` | Yes | gRPC port (typically 8081). |
| `domain` | Yes | Must match the `domain` in the rate limit service configuration. |
| `descriptors` | Yes | Array of descriptor rules (max 16). Each rule extracts request attributes. |
| `descriptors[].entries` | Yes | Array of descriptor entries (max 16). Each entry uses a CEL expression to extract a value. |
| `descriptors[].entries[].name` | Yes | Descriptor name. Must match a `key` in the rate limit service config. Case-sensitive. |
| `descriptors[].entries[].expression` | Yes | CEL expression returning a string. Examples: `source.address`, `request.path`, `request.headers["x-user-id"]`. |
| `descriptors[].unit` | No | Cost unit: `Requests` (default) or `Tokens`. Use `Tokens` for LLM token-based rate limiting. |

**How it works:**

1. The CEL expression `source.address` extracts the client IP (e.g., `"192.168.1.100"`)
2. The gateway sends `{ key: "remote_address", value: "192.168.1.100" }` to the rate limit service
3. The service matches this against its configuration's `remote_address` descriptor
4. If the client has made more than 10 requests in the last minute (per the config), the service returns `OVER_LIMIT`
5. The gateway returns 429 to the client

### Rate limit by user ID

Extract the user ID from a header and rate limit per user.

```yaml
kubectl apply -f- <<EOF
apiVersion: {{< reuse "agw-docs/snippets/trafficpolicy-apiversion.md" >}}
kind: {{< reuse "agw-docs/snippets/trafficpolicy.md" >}}
metadata:
  name: user-rate-limit
  namespace: httpbin
spec:
  targetRefs:
  - group: gateway.networking.k8s.io
    kind: HTTPRoute
    name: httpbin
  traffic:
    rateLimit:
      global:
        backendRef:
          name: ratelimit
          namespace: ratelimit
          port: 8081
        domain: api-gateway
        descriptors:
          - entries:
              - name: x-user-id
                expression: 'request.headers["x-user-id"]'
EOF
```

The CEL expression `request.headers["x-user-id"]` extracts the header value. Each unique user ID gets its own rate limit counter.

### Rate limit by request path

Apply different rate limits to different API paths.

```yaml
kubectl apply -f- <<EOF
apiVersion: {{< reuse "agw-docs/snippets/trafficpolicy-apiversion.md" >}}
kind: {{< reuse "agw-docs/snippets/trafficpolicy.md" >}}
metadata:
  name: path-rate-limit
  namespace: httpbin
spec:
  targetRefs:
  - group: gateway.networking.k8s.io
    kind: HTTPRoute
    name: httpbin
  traffic:
    rateLimit:
      global:
        backendRef:
          name: ratelimit
          namespace: ratelimit
          port: 8081
        domain: api-gateway
        descriptors:
          - entries:
              - name: path
                expression: "request.path"
EOF
```

The rate limit service configuration defines different limits for `/api/v1` (100/min) vs `/api/v2` (200/min).

### Rate limit by service tier (static descriptor)

Use a static value to categorize traffic — for example, by service tier.

```yaml
kubectl apply -f- <<EOF
apiVersion: {{< reuse "agw-docs/snippets/trafficpolicy-apiversion.md" >}}
kind: {{< reuse "agw-docs/snippets/trafficpolicy.md" >}}
metadata:
  name: tier-rate-limit
  namespace: httpbin
spec:
  targetRefs:
  - group: gateway.networking.k8s.io
    kind: HTTPRoute
    name: httpbin
  traffic:
    rateLimit:
      global:
        backendRef:
          name: ratelimit
          namespace: ratelimit
          port: 8081
        domain: api-gateway
        descriptors:
          - entries:
              - name: service
                expression: '"premium"'
EOF
```

The CEL expression `"premium"` returns a constant string. All traffic on this route is treated as "premium" tier and gets 1000 requests per minute.

### Nested descriptors (multi-dimensional rate limiting)

Combine multiple descriptor entries to create composite rate limits — for example, "per user per path" or "per IP per API key".

```yaml
kubectl apply -f- <<EOF
apiVersion: {{< reuse "agw-docs/snippets/trafficpolicy-apiversion.md" >}}
kind: {{< reuse "agw-docs/snippets/trafficpolicy.md" >}}
metadata:
  name: nested-rate-limit
  namespace: httpbin
spec:
  targetRefs:
  - group: gateway.networking.k8s.io
    kind: HTTPRoute
    name: httpbin
  traffic:
    rateLimit:
      global:
        backendRef:
          name: ratelimit
          namespace: ratelimit
          port: 8081
        domain: api-gateway
        descriptors:
          - entries:
              - name: x-user-id
                expression: 'request.headers["x-user-id"]'
              - name: path
                expression: "request.path"
EOF
```

The rate limit service must have a nested descriptor configuration to match:

```yaml
domain: api-gateway
descriptors:
  - key: x-user-id
    value: "alice"
    descriptors:
      - key: path
        value: "/api/v1"
        rate_limit:
          unit: minute
          requests_per_unit: 50
```

This allows different limits for the same user hitting different paths.

### Combine local and global rate limiting

Apply both in-process and distributed rate limits to the same traffic.

```yaml
kubectl apply -f- <<EOF
apiVersion: {{< reuse "agw-docs/snippets/trafficpolicy-apiversion.md" >}}
kind: {{< reuse "agw-docs/snippets/trafficpolicy.md" >}}
metadata:
  name: combined-rate-limit
  namespace: httpbin
spec:
  targetRefs:
  - group: gateway.networking.k8s.io
    kind: HTTPRoute
    name: httpbin
  traffic:
    rateLimit:
      local:
        - requests: 100
          unit: Seconds
      global:
        backendRef:
          name: ratelimit
          namespace: ratelimit
          port: 8081
        domain: api-gateway
        descriptors:
          - entries:
              - name: x-user-id
                expression: 'request.headers["x-user-id"]'
EOF
```

This configuration enforces:
- **Local**: 100 requests per second per proxy replica (protects against traffic spikes)
- **Global**: 50 requests per minute per user across all replicas (enforces user quotas)

Both limits are evaluated. A request must pass both checks to succeed.

## Test the rate limits {#test}

1. Send requests without the `x-user-id` header. These requests won't match the user-based descriptor and will be allowed (assuming no other descriptors match).

   {{< tabs tabTotal="2" items="Cloud Provider LoadBalancer,Port-forward for local testing" >}}
   {{% tab tabName="Cloud Provider LoadBalancer" %}}
   ```sh
   curl -i http://$INGRESS_GW_ADDRESS:80/get -H "host: www.example.com"
   ```
   {{% /tab %}}
   {{% tab tabName="Port-forward for local testing" %}}
   ```sh
   curl -i localhost:8080/get -H "host: www.example.com"
   ```
   {{% /tab %}}
   {{< /tabs >}}

2. Send requests with a user ID header. These are rate limited according to the service configuration.

   {{< tabs tabTotal="2" items="Cloud Provider LoadBalancer,Port-forward for local testing" >}}
   {{% tab tabName="Cloud Provider LoadBalancer" %}}
   ```sh
   for i in $(seq 1 60); do
     STATUS=$(curl -s -o /dev/null -w "%{http_code}" \
       http://$INGRESS_GW_ADDRESS:80/get \
       -H "host: www.example.com" \
       -H "x-user-id: alice")
     echo "Request $i: HTTP $STATUS"
   done
   ```
   {{% /tab %}}
   {{% tab tabName="Port-forward for local testing" %}}
   ```sh
   for i in $(seq 1 60); do
     STATUS=$(curl -s -o /dev/null -w "%{http_code}" \
       localhost:8080/get \
       -H "host: www.example.com" \
       -H "x-user-id: alice")
     echo "Request $i: HTTP $STATUS"
   done
   ```
   {{% /tab %}}
   {{< /tabs >}}

   With a limit of 50 requests per minute for user "alice", the first 50 requests succeed with 200, and subsequent requests return 429.

3. Inspect a rate-limited response:

   {{< tabs tabTotal="2" items="Cloud Provider LoadBalancer,Port-forward for local testing" >}}
   {{% tab tabName="Cloud Provider LoadBalancer" %}}
   ```sh
   curl -i http://$INGRESS_GW_ADDRESS:80/get \
     -H "host: www.example.com" \
     -H "x-user-id: alice"
   ```
   {{% /tab %}}
   {{% tab tabName="Port-forward for local testing" %}}
   ```sh
   curl -i localhost:8080/get \
     -H "host: www.example.com" \
     -H "x-user-id: alice"
   ```
   {{% /tab %}}
   {{< /tabs >}}

   Example output:

   ```
   HTTP/1.1 429 Too Many Requests
   x-ratelimit-limit: 50, 50;w=60
   x-ratelimit-remaining: 0
   x-ratelimit-reset: 42
   x-envoy-ratelimited: true
   content-length: 18

   rate limit exceeded
   ```

## Cleanup

{{< reuse "agw-docs/snippets/cleanup.md" >}}

```sh
kubectl delete {{< reuse "agw-docs/snippets/trafficpolicy.md" >}} ip-rate-limit user-rate-limit path-rate-limit tier-rate-limit nested-rate-limit combined-rate-limit -n httpbin
kubectl delete deployment ratelimit redis -n ratelimit
kubectl delete service ratelimit redis -n ratelimit
kubectl delete configmap ratelimit-config -n ratelimit
kubectl delete namespace ratelimit
```

## Common CEL expressions {#cel-expressions}

| Descriptor | CEL Expression | Description |
|-----------|----------------|-------------|
| Client IP | `source.address` | Source IP address of the client |
| Request path | `request.path` | The request path (e.g., `/api/v1/users`) |
| Request method | `request.method` | HTTP method (GET, POST, etc.) |
| Header value | `request.headers["header-name"]` | Extract a specific header. Case-insensitive header name. |
| Query parameter | `request.url_path.query_params["param"]` | Extract a query parameter value |
| JWT claim | `claims["sub"]` | Extract a claim from a validated JWT (requires JWT auth policy) |
| Static value | `"constant"` | Use a constant string for categorization (e.g., service tier) |
| Host header | `request.headers["host"]` | The Host header value |
| User agent | `request.headers["user-agent"]` | Client user agent string |

## Summary

| What you want | How to configure it |
|--------------|---------------------|
| Rate limit by client IP | Descriptor entry with `expression: "source.address"` |
| Rate limit by user ID | Descriptor entry with `expression: 'request.headers["x-user-id"]'` |
| Rate limit by path | Descriptor entry with `expression: "request.path"` |
| Apply same limit to all traffic | Descriptor entry with `expression: '"static-value"'` |
| Different limits per user per path | Two entries in same descriptor: user ID + path (requires nested config in service) |
| Combine local and global limits | Include both `local[]` and `global` in same policy |
| Token-based rate limiting (LLMs) | Set `descriptors[].unit: Tokens` and configure token limits in service |

Global rate limiting is the right choice when you need shared quotas across multiple proxy replicas, fine-grained control based on request attributes, or integration with existing rate limiting infrastructure. For simpler per-replica limits, use [local rate limiting]({{< link-hextra path="/security/rate-limit-http#local" >}}).

For AI-specific use cases:
- [LLM token-based rate limiting]({{< link-hextra path="/llm/rate-limit" >}})
- [MCP tool call rate limiting]({{< link-hextra path="/mcp/rate-limit" >}})
