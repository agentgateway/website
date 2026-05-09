Inspect the runtime configuration that an agentgateway proxy has loaded by using `agctl config`.

## About

`agctl config` reads an agentgateway proxy's admin endpoint at `/config_dump` and renders the result as a structured table or as JSON or YAML. Use it to confirm what the proxy actually loaded, especially when an HTTPRoute or policy is `Accepted` but the proxy does not behave as expected.

`agctl config` resolves the proxy pod for you, opens a port-forward to its admin port, and renders the output. You do not need to manage `kubectl port-forward` yourself.

`agctl config` includes the following subcommands.

| Subcommand | What it returns |
| -- | -- |
| `agctl config all` | The full runtime configuration: binds, listeners, routes, backends, workloads, services, and policies. |
| `agctl config backends` | A table of backends with their endpoint health, request counts, and latency, scoped to the backends that the proxy is actually routing to. Pass `--all` to include every workload that the proxy knows about, including those with zero requests. |

## Before you begin

* [Install agctl]({{< link-hextra path="/operations/agctl" >}}).
* Install agentgateway and create a Gateway. The examples in this guide use the agentgateway proxy that the [Get started]({{< link-hextra path="/quickstart/" >}}) installs in the `{{< reuse "agw-docs/snippets/namespace.md" >}}` namespace.
* Have at least one HTTPRoute attached to the Gateway. The examples assume the `httpbin` HTTPRoute from the [non-agentic HTTP quickstart]({{< link-hextra path="/quickstart/non-agentic-http" >}}).

## Steps

{{% steps %}}

### Step 1: Render the full configuration

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

### Step 2: List active backends

Print a table of backends that the gateway is actively routing to, with endpoint health and request stats.

```sh
agctl config backends gateway/agentgateway-proxy -n {{< reuse "agw-docs/snippets/namespace.md" >}}
```

Example output:

```
TYPE     NAME       NAMESPACE            ENDPOINT                    HEALTH  REQUESTS  LATENCY
Backend  openai     agentgateway-system  backend                     0.70    1         0.00ms
Service  ext-authz  backend-extauth      ext-authz-7c7596b5f6-tvs28  1.00    4         0.00ms
Service  httpbin    backend-extauth      httpbin-7dc88b5fbc-zqrfn    1.00    2         3.06ms
```

The columns mean the following.

| Column | Meaning |
| -- | -- |
| `TYPE` | `Backend` for an agentgateway `Backend` resource, `Service` for a Kubernetes Service resolved through xDS. |
| `NAME` | The backend or service name. |
| `NAMESPACE` | The namespace that the backend or service lives in. |
| `ENDPOINT` | The pod or static target backing the entry. |
| `HEALTH` | A score between 0.0 and 1.0 derived from recent request outcomes. Values below `1.0` indicate that some requests have failed. |
| `REQUESTS` | The number of requests sent to the endpoint since the proxy started. |
| `LATENCY` | The mean upstream latency for the endpoint. |

### Step 3: Include zero-request workloads

By default, `agctl config backends` only shows backends that the proxy is actively routing to. To include every service and workload that the proxy knows about, including those with zero requests, pass `--all`.

```sh
agctl config backends gateway/agentgateway-proxy -n {{< reuse "agw-docs/snippets/namespace.md" >}} --all
```

The expanded view is useful for confirming that the proxy is aware of a service before you create an HTTPRoute that targets it.

### Step 4: Use other output formats

Both subcommands accept the `-o` flag with `short`, `json`, and `yaml` values.

```sh
# Backends as JSON, for piping to jq
agctl config backends gateway/agentgateway-proxy -n {{< reuse "agw-docs/snippets/namespace.md" >}} -o json | jq '.[] | select(.health < 1.0)'
```

{{< callout type="note" >}}
For `agctl config all`, the `short` and `json` outputs both return the full pretty-printed configuration. There is no compressed table view for the full configuration today.
{{< /callout >}}

{{% /steps %}}

## Troubleshooting

### `accepts at most 1 arg(s)`

**What's happening**: `agctl config` returns this error.

**Why it's happening**: You passed more than one resource argument or combined `--file` with a resource argument.

**How to fix it**: Pass exactly one resource argument (`gateway/<name>`), or pass `--file <path>` instead.

### Wrong proxy port

**What's happening**: `agctl config` opens a port-forward but cannot reach the admin endpoint.

**Why it's happening**: The proxy admin port is not the default `15000`. For example, you set a custom `adminAddr` in your gateway parameters.

**How to fix it**: Pass `--proxy-admin-port` to point `agctl` at the right port.

```sh
agctl config all gateway/agentgateway-proxy -n {{< reuse "agw-docs/snippets/namespace.md" >}} --proxy-admin-port 16000
```

## What's next

* [Trace requests with agctl]({{< link-hextra path="/operations/trace-requests" >}}).
* [Debug your setup]({{< link-hextra path="/operations/debug" >}}).
