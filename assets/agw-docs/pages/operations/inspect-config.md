Inspect the runtime configuration that an agentgateway proxy loaded by using `agctl config`.

## About

`agctl config` reads an agentgateway proxy's admin endpoint at `/config_dump` and renders the result as a structured table or as JSON or YAML. Use it to confirm what the proxy actually loaded, especially when an HTTPRoute or policy is `Accepted` but the proxy does not behave as expected.

`agctl config` resolves the proxy pod for you, opens a port-forward to its admin port, and renders the output. You do not need to manage `kubectl port-forward` yourself.

`agctl config` includes the following subcommands.

| Subcommand | What it returns |
| -- | -- |
| `agctl config all` | The full runtime configuration: binds, listeners, routes, backends, workloads, services, and policies. |
| `agctl config backends` | A table of backends with their endpoint health, request counts, and latency, scoped to the backends that the proxy is actually routing to. Pass `--all` to include every workload that the proxy knows about, including those with zero requests. |

## Before you begin

1. [Install agctl]({{< link-hextra path="/operations/agctl" >}}).
2. {{< reuse "agw-docs/snippets/agentgateway-prereq.md" >}}
3. Have an HTTPRoute that the trace request matches. The examples assume the `httpbin` HTTPRoute from the [non-agentic HTTP quickstart]({{< link-hextra path="/quickstart/non-agentic-http" >}}), which routes `www.example.com` to the httpbin service.

## Render the full configuration

Render the configuration that the proxy has loaded, as YAML.

```sh
agctl config all gateway/agentgateway-proxy -n {{< reuse "agw-docs/snippets/namespace.md" >}} -o yaml
```

The output includes every `bind`, `listener`, `route`, `backend`, `workload`, `service`, and `policy` that the proxy knows about, along with the agentgateway build info. Use it to confirm that your route and policy resources actually translated to the configuration you expected.

You can also dump the configuration to a file and inspect it offline.

```sh
agctl config all gateway/agentgateway-proxy -n {{< reuse "agw-docs/snippets/namespace.md" >}} -o json > /tmp/agw-dump.json
agctl config all --file /tmp/agw-dump.json -o yaml
```

## List active backends

Print a table of backends that the gateway is actively routing to, with endpoint health and request stats.

```sh
agctl config backends gateway/agentgateway-proxy -n {{< reuse "agw-docs/snippets/namespace.md" >}}
```

Example output:

```console
TYPE     NAME       NAMESPACE            ENDPOINT                    HEALTH  REQUESTS  LATENCY
Backend  openai     agentgateway-system  backend                     0.70    1         0.00ms
Service  ext-authz  backend-extauth      ext-authz-7c7596b5f6-tvs28  1.00    4         0.00ms
Service  httpbin    backend-extauth      httpbin-7dc88b5fbc-zqrfn    1.00    2         3.06ms
```

The columns mean the following.

| Column | Meaning |
| -- | -- |
| `TYPE` | `Backend` for an {{< reuse "agw-docs/snippets/backend.md" >}} resource, `Service` for a Kubernetes Service resolved through xDS. |
| `NAME` | The backend or service name. |
| `NAMESPACE` | The namespace that the backend or service lives in. |
| `ENDPOINT` | The pod or static target backing the entry. |
| `HEALTH` | A score between 0.0 and 1.0 derived from recent request outcomes. Values below `1.0` indicate that some requests have failed. |
| `REQUESTS` | The number of requests sent to the endpoint since the proxy started. |
| `LATENCY` | The mean upstream latency for the endpoint. |

## Include zero-request workloads

By default, `agctl config backends` only shows backends that the proxy is actively routing to. To include every service and workload that the proxy knows about, including those with zero requests, pass `--all`.

```sh
agctl config backends gateway/agentgateway-proxy -n {{< reuse "agw-docs/snippets/namespace.md" >}} --all
```

The expanded view is useful for confirming that the proxy is aware of a service before you create an HTTPRoute that targets it.

```console
TYPE     NAME                NAMESPACE            ENDPOINT                                                      HEALTH  REQUESTS  LATENCY
Backend  openai              agentgateway-system  backend                                                       1.00    1         4682.37ms
Service  agentgateway        agentgateway-system  agentgateway-56b5fd7ffd-8r2nj                                 1.00    0         
Service  agentgateway-proxy  agentgateway-system  agentgateway-proxy-784ffbfc76-pcpqk                           1.00    0         
Service  kubernetes          default              discovery.k8s.io/EndpointSlice/default/kubernetes/172.18.0.3  1.00    0         
Service  httpbin             httpbin              httpbin-6bc5b79755-bsmzr                                      1.00    5         1.54ms
Service  kube-dns            kube-system          coredns-674b8bbfcf-gnqbg                                      1.00    0         
Service  kube-dns            kube-system          coredns-674b8bbfcf-mfs4f                                      1.00    0         
```

## Use other output formats

Both subcommands accept the `-o` flag with `short`, `json`, and `yaml` values. The `short` and `json` outputs both return the full pretty-printed configuration. Note that there is no compressed table view for the full configuration.

```sh
# Use jq to show backends where some requests failed
agctl config backends gateway/agentgateway-proxy -n {{< reuse "agw-docs/snippets/namespace.md" >}} -o json | jq '.[] | select(.health < 1.0)'
```
