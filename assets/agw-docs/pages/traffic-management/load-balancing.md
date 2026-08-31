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

- Reduce cross-zone traffic with [locality-aware routing]({{< link-hextra path="/documentation/traffic-management/locality-aware-routing/" >}}).
- Remove failing endpoints from the pool with [backend health checking]({{< link-hextra path="/documentation/resiliency/backend-health/" >}}).
- Distribute requests across LLM providers with [LLM load balancing]({{< link-hextra path="/documentation/llm/load-balancing/" >}}).
