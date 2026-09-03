Distribute requests across the endpoints of a backend, for every kind of traffic that the gateway proxies.

## About load balancing {#about}

{{< reuse "agw-docs/snippets/agentgateway-capital.md" >}} load balances requests across the endpoints of a backend by using the **Power of Two Choices (P2C)** algorithm with health-aware scoring.

P2C applies to all traffic that the gateway proxies, not only to Large Language Model (LLM) traffic. Plain HTTP, gRPC, Model Context Protocol (MCP), and LLM backends share the same load balancer. The [LLM load balancing]({{< link-hextra path="/documentation/llm/load-balancing/" >}}) guide applies the same algorithm across LLM providers.

For each request, {{< reuse "agw-docs/snippets/agentgateway.md" >}} does the following:

1. Selects two endpoints at random from the highest-priority locality bucket that has viable endpoints. The same endpoint can be selected twice, which keeps the lowest-scored endpoint reachable instead of starving it of traffic.
2. Scores each of the two endpoints based on health, latency, and pending requests.
3. Routes the request to the endpoint with the better score.

## What the proxy load balances across {#endpoints}

Whether {{< reuse "agw-docs/snippets/agentgateway.md" >}} load balances across individual pods depends on how you reference the backend, not on the kind of traffic that you send.

| Backend reference | What the proxy resolves | What makes the load balancing decision |
| -- | -- | -- |
| A Kubernetes Service, such as an HTTPRoute `backendRefs` entry that points to a Service | The individual endpoints of the Service, from its EndpointSlices | {{< reuse "agw-docs/snippets/agentgateway-capital.md" >}}, with P2C and health-aware scoring |
| A hostname or IP address, such as an {{< reuse "agw-docs/snippets/backend.md" >}} that sets a `host` field | One opaque dial target | The DNS resolver, or kube-proxy when the hostname resolves to a `ClusterIP` |

By default when you route to a Kubernetes Service, {{< reuse "agw-docs/snippets/agentgateway.md" >}} connects to a pod IP address directly, not to the `ClusterIP`, so kube-proxy does not make the load balancing decision.

> [!NOTE]
> To load balance across the pod replicas of a self-hosted LLM backend, reference the Service instead of setting the `host` and `port` fields. For more information, see [Load balancing across pod replicas]({{< link-hextra path="/documentation/llm/load-balancing/#pod-replicas" >}}).

## How endpoints are scored {#scoring}

{{< reuse "agw-docs/snippets/agentgateway-capital.md" >}} scores each endpoint on the following factors.

| Factor | Description |
| -- | -- |
| Health | An exponentially-weighted moving average (EWMA) of recent request outcomes. Each successful request records `1.0` and each failure records `0.0`, with recent results weighted more heavily. |
| Request latency | An EWMA of the upstream response time, in seconds. Only successful requests contribute, so that fast error responses do not skew the average. |
| Pending requests | The number of in-flight requests to the endpoint. Each pending request adds a 10 percent penalty to the latency component. |

The score for each endpoint is calculated as follows.

```
score = health / (1 + latency_penalty)
where latency_penalty = request_latency * (1 + pending_requests * 0.1)
```

Endpoints that consistently fail are moved to a rejected set and are considered only when no active endpoint is viable. As a result, traffic shifts away from a slow or failing pod without any configuration on your part.

<!-- Gated by excluding the older version, not by including "main", so the
     section stays put when the next release freezes this line under a number.
     The `sessionAffinity` backend policy is new to the Kubernetes API in the
     version that `main` currently points at. -->
{{< version exclude-if="1.5.x" >}}
## Session affinity {#session-affinity}

P2C selects an endpoint independently for each request, so two requests from the same client can land on different endpoints. To send every request that carries the same value to the same endpoint, set the `sessionAffinity` backend policy.

A `source` CEL expression selects the value. {{< reuse "agw-docs/snippets/agentgateway-capital.md" >}} hashes the value and maps the hash to an endpoint with weighted rendezvous hashing, so proxy replicas that see the same value and the same set of eligible endpoints pick the same endpoint without sharing any state with each other.

Set the policy on the {{< reuse "agw-docs/snippets/backend.md" >}} that you route to.

```yaml
apiVersion: agentgateway.dev/v1alpha1
kind: AgentgatewayBackend
metadata:
  name: my-backend
  namespace: {{< reuse "agw-docs/snippets/namespace.md" >}}
spec:
  policies:
    sessionAffinity:
      source: request.headers["x-session-id"]
```

You can also set the policy in an {{< reuse "agw-docs/snippets/policy.md" >}} resource, in the `spec.backend` section, to apply it to a group of backends.

```yaml
apiVersion: agentgateway.dev/v1alpha1
kind: AgentgatewayPolicy
metadata:
  name: my-affinity-policy
  namespace: {{< reuse "agw-docs/snippets/namespace.md" >}}
spec:
  targetRefs:
  - group: agentgateway.dev
    kind: AgentgatewayBackend
    name: my-backend
  backend:
    sessionAffinity:
      source: request.headers["x-session-id"]
```

| Field | Required | Description |
| -- | -- | -- |
| `source` | Yes | CEL expression evaluated against the request. It must return a string or bytes value. Requests that produce the same value are sent to the same healthy endpoint. The expression can be up to 16384 characters. |

Common expressions for `source` include the following.

| Expression | Affinity per |
| -- | -- |
| `request.headers["x-session-id"]` | Session identifier that the client sends. |
| `string(source.address)` | Client IP address. |
| `jwt.sub` | Authenticated user, when a JWT policy runs on the same route. |

For the full list of values that an expression can read, see the [CEL variables reference]({{< link-hextra path="/reference/cel/variables/" >}}).

### AI backends {#session-affinity-ai}

On an AI backend, affinity applies across the provider groups of the backend. Set it on the whole {{< reuse "agw-docs/snippets/backend.md" >}}, not on an individual provider. An {{< reuse "agw-docs/snippets/policy.md" >}} that sets `backend.sessionAffinity` and also names a `sectionName` on an {{< reuse "agw-docs/snippets/backend.md" >}} target is rejected with the message `backend.sessionAffinity must target the whole AgentgatewayBackend, not an individual AI provider`. The rule applies to any sectioned {{< reuse "agw-docs/snippets/backend.md" >}} target, not only to AI providers.

### What session affinity does not do {#session-affinity-limits}

Session affinity is best-effort, and it is **not** session persistence. {{< reuse "agw-docs/snippets/agentgateway-capital.md" >}} does not record which endpoint a value was sent to. It recomputes the mapping for each request from the value and the set of healthy endpoints, which has two consequences.

- **The mapping moves when the endpoint set changes.** Adding, removing, or losing an endpoint remaps some values, so a client can be moved to a different endpoint mid-session. Rendezvous hashing keeps that disruption small, because only the values that mapped to the changed endpoint move, but it is not zero.
- **A request that produces no usable value is not pinned.** {{< reuse "agw-docs/snippets/agentgateway-capital.md" >}} falls back to normal P2C selection when the expression fails to evaluate, returns a value that is not a string or bytes, or returns an empty value, such as a header that the client did not send. The request still succeeds.
- **Affinity does not override priority or health.** The hash chooses among the endpoints that are already eligible, rather than reaching past them. {{< reuse "agw-docs/snippets/agentgateway-capital.md" >}} works through the locality priority buckets in order and stops at the first bucket that holds a viable endpoint, and it considers the rejected set only when no active endpoint is viable anywhere. So two replicas in different localities can map the same value to different endpoints, and a value is remapped when the preferred bucket for a replica changes. For more information, see [locality-aware routing]({{< link-hextra path="/documentation/traffic-management/locality-aware-routing/" >}}).

Do not use session affinity to hold server-side state that only one endpoint has. Use it to improve cache hit rates, to keep a conversation on one replica when that is a preference rather than a requirement, or to make debugging easier.

> [!TIP]
> A fallback is silent by design, so a misconfigured expression looks the same as working affinity from the outside. Each miss is logged at `trace` level with the expression and the reason, so run the proxy with trace logging when affinity does not appear to take effect.

Two other features choose an endpoint before affinity does, and they win when they apply: [inference routing]({{< link-hextra path="/documentation/llm/inference/" >}}), and a stateful MCP session that is already pinned to an upstream server. In practice they do not conflict, because they target different backends.

> [!NOTE]
> This policy is unrelated to MCP session routing, which controls whether {{< reuse "agw-docs/snippets/agentgateway.md" >}} keeps an MCP session with the upstream server. Session affinity chooses an endpoint. MCP session routing chooses how the MCP protocol session is managed.
{{< /version >}}

## How load balancing interacts with other routing features {#interactions}

Endpoint selection is one stage of routing. The following features run before or instead of the P2C selection.

| Feature | Interaction |
| -- | -- |
| [Locality-aware routing]({{< link-hextra path="/documentation/traffic-management/locality-aware-routing/" >}}) | Endpoints are grouped into priority buckets by locality. P2C selects within the highest-priority bucket that has viable endpoints. |
| [Traffic splitting]({{< link-hextra path="/documentation/traffic-management/traffic-split/" >}}) | Weights choose which *backend* receives the request. P2C then chooses an endpoint within that backend. |
| [Backend health checking]({{< link-hextra path="/documentation/resiliency/backend-health/" >}}) | Active health checks remove an endpoint from the pool, in addition to the passive health scoring described above. |

## Verify which endpoints the proxy resolved {#verify}

To confirm that the proxy resolved a Service to its endpoints, list the backends that the proxy is routing to.

```sh
agctl proxy config backends gateway/agentgateway-proxy -n {{< reuse "agw-docs/snippets/namespace.md" >}}
```

The `TYPE` column tells you which case you are in. A `Service` row means that the proxy resolved the Kubernetes Service and load balances across its endpoints, one row per endpoint, named in the `ENDPOINT` column. A `Backend` row means an {{< reuse "agw-docs/snippets/backend.md" >}} resource, which might be an opaque hostname.

```console
TYPE     NAME       NAMESPACE            ENDPOINT                    HEALTH  REQUESTS  LATENCY
Backend  openai     agentgateway-system  backend                     0.70    1         0.00ms
Service  ext-authz  backend-extauth      ext-authz-7c7596b5f6-tvs28  1.00    4         0.00ms
Service  httpbin    backend-extauth      httpbin-7dc88b5fbc-zqrfn    1.00    2         3.06ms
```

> [!NOTE]
> A `service` entry in the `agctl proxy config all` output means the same thing: the proxy is aware of the endpoints of the Service. It does not mean that the proxy routes to the `ClusterIP` of the Service.

For more information about these commands, including how to show services that have received no requests, see [Inspect the proxy configuration]({{< link-hextra path="/documentation/operations/inspect-config/" >}}).

## Next steps

{{< version exclude-if="1.5.x" >}}- Pin the requests that share a value to one endpoint with [session affinity](#session-affinity). {{< /version >}}
- Reduce cross-zone traffic with [locality-aware routing]({{< link-hextra path="/documentation/traffic-management/locality-aware-routing/" >}}).
- Remove failing endpoints from the pool with [backend health checking]({{< link-hextra path="/documentation/resiliency/backend-health/" >}}).
- Distribute requests across LLM providers with [LLM load balancing]({{< link-hextra path="/documentation/llm/load-balancing/" >}}).
