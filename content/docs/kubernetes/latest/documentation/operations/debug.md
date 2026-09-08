---
title: Debug your setup
weight: 15
description: Debug your agentgateway environment.
---

Inspect and troubleshoot agentgateway proxies through the admin endpoints and the [`agctl`]({{< link-hextra path="/documentation/operations/agctl" >}}) command-line tool.

## Admin endpoints

Each agentgateway pod runs an admin server on port `15000`. The admin server provides the following endpoints for inspection and debugging.

| Endpoint | Description |
| -- | -- |
| `/config_dump` | Returns the runtime configuration that the proxy has loaded, including binds, listeners, routes, backends, workloads, services, and policies. |
| `/debug/trace` | Streams a JSON-over-SSE trace of the next request that the proxy handles. The `agctl proxy trace` command consumes this endpoint. |
| `/logging` | Get and set the logging level at runtime. |
| `/memory` | Dump allocator and process memory statistics. |
| `/debug/pprof/profile` | Build a CPU profile by using the [pprof](https://github.com/google/pprof) profiler. Use `?seconds=N` to set the duration (1–300s, default 10s) and `?frequency=N` to set the sampling rate in Hz (1–1000, default 100). |
| `/debug/pprof/heap` | Collect heap profiling data. |
| `/debug/tasks` | Inspect the live tokio task tree. |
| `/quitquitquit` | Trigger a graceful shutdown of the proxy. |

To inspect the configuration that a gateway proxy has loaded and to capture per-request traces, use the [`agctl`]({{< link-hextra path="/documentation/operations/agctl" >}}) command-line tool. `agctl` resolves the proxy pod for you, opens a port-forward, and renders the admin output in formats that are easier to scan than raw JSON.

## Before you begin

[Install agctl]({{< link-hextra path="/documentation/operations/agctl" >}}).

## Check the gateway, route, and policy status

Most routing and policy issues surface in the status of the corresponding Kubernetes resource. Check these first.

1. Verify that the agentgateway control plane and proxy pods are running.

   {{< tabs >}}
   {{% tab name="Replace with your own" %}}
   ```sh
   kubectl get pods -n <namespace>
   ```
   {{% /tab %}}
   {{% tab name="Quickstart example" %}}
   ```sh
   kubectl get pods -n agentgateway-system
   ```
   {{% /tab %}}
   {{< /tabs >}}

2. Verify the Gateway is `Accepted` and `Programmed`.

   {{< tabs >}}
   {{% tab name="Replace with your own" %}}
   ```sh
   kubectl get gateway -A
   kubectl get gateway <name> -n <namespace> -o yaml
   ```
   {{% /tab %}}
   {{% tab name="Quickstart example" %}}
   ```sh
   kubectl get gateway agentgateway-proxy -n agentgateway-system -o yaml
   ```
   {{% /tab %}}
   {{< /tabs >}}

3. Check the HTTPRoute for `Accepted` and `ResolvedRefs` conditions.

   ```sh
   kubectl get httproute -A
   ```

   {{< tabs >}}
   {{% tab name="Replace with your own" %}}
   ```sh
   kubectl get httproute <name> -n <namespace> -o yaml
   ```
   {{% /tab %}}
   {{% tab name="Quickstart example" %}}
   ```sh
   kubectl get httproute openai -n agentgateway-system -o yaml
   ```
   {{% /tab %}}
   {{< /tabs >}}

   Common issues to check for:

   * The wrong backend is selected.
   * The wrong parent Gateway is referenced.
   * Multiple HTTPRoutes conflict by having identical matchers or by having no matchers (and so default to `/`).

## Inspect the loaded configuration

Sometimes a route is `Accepted` but the proxy still does not behave as expected. To see what the proxy actually loaded, dump its runtime configuration.

1. Render a summary of the routes, backends, and policies that the gateway has loaded.

   {{< tabs >}}
   {{% tab name="Replace with your own" %}}
   ```sh
   agctl proxy config all gateway/<gateway-name> -n <namespace> -o yaml
   ```
   {{% /tab %}}
   {{% tab name="Quickstart example" %}}
   ```sh
   agctl proxy config all gateway/agentgateway-proxy -n agentgateway-system -o yaml
   ```
   {{% /tab %}}
   {{< /tabs >}}

2. Inspect the backends that the gateway is sending traffic to and their endpoint health.

   {{< tabs >}}
   {{% tab name="Replace with your own" %}}
   ```sh
   agctl proxy config backends gateway/<gateway-name> -n <namespace>
   ```
   {{% /tab %}}
   {{% tab name="Quickstart example" %}}
   ```sh
   agctl proxy config backends gateway/agentgateway-proxy -n agentgateway-system
   ```
   {{% /tab %}}
   {{< /tabs >}}

   Example output:

   ```
   TYPE     NAME       NAMESPACE            ENDPOINT                    HEALTH  REQUESTS  LATENCY
   Backend  openai     agentgateway-system  backend                     1.00    1         4682.37ms
   Service  ext-authz  backend-extauth      ext-authz-7c7596b5f6-tvs28  0.70    4         0.00ms
   Service  httpbin    backend-extauth      httpbin-7dc88b5fbc-zqrfn    1.00    2         3.06ms
   ```

For complete steps, see [Inspect agentgateway configuration]({{< link-hextra path="/documentation/operations/inspect-config" >}}).

## Trace requests

To see how a specific request flows through agentgateway, use `agctl proxy trace`. The trace shows you the route that was selected, the policies that were applied, the backend that was chosen, and the response status. Tracing helps you understand why a request did or did not match a route, why a policy was or was not applied, or why a request returned an unexpected status.

{{< tabs >}}
{{% tab name="Replace with your own" %}}
```sh
agctl proxy trace gateway/<gateway-name> -n <namespace> --port <listener-port> -- http://<host>/<path>
```
{{% /tab %}}
{{% tab name="Quickstart example" %}}

```sh
agctl proxy trace gateway/agentgateway-proxy -n agentgateway-system --port 8080 -- http://httpbin.example.com/
```
{{% /tab %}}
{{< /tabs >}}

`agctl` opens a port-forward to the proxy pod, captures the trace, sends the request, and renders the result in a text-based terminal user interface (TUI). Use `--raw` to print JSON Lines instead.

For complete steps, see [Trace requests with agctl]({{< link-hextra path="/documentation/operations/trace-requests" >}}).

## Enable debug logs {#debug-logs}

Agentgateway uses the same level syntax as [`RUST_LOG`](https://docs.rs/env_logger/latest/env_logger/#enabling-logging): `error`, `warn`, `info`, `debug`, and `trace`. Use `agctl` to read and change log levels at runtime for both the proxy and the controller. `agctl` resolves the pod and opens a port-forward for you, so you do not need to manage `kubectl port-forward` yourself.

### Proxy logs

1. Show the proxy's current log filter directive.

   {{< tabs >}}
   {{% tab name="Replace with your own" %}}
   ```sh
   agctl proxy log gateway/<gateway-name> -n <namespace>
   ```
   {{% /tab %}}
   {{% tab name="Quickstart example" %}}
   ```sh
   agctl proxy log gateway/agentgateway-proxy -n agentgateway-system
   ```
   {{% /tab %}}
   {{< /tabs >}}

2. Set the global log level for the proxy.

   ```sh
   agctl proxy log gateway/agentgateway-proxy -n agentgateway-system --level debug
   ```

   Example output:

   ```
   current log level is typespec_client_core::http::policies::logging=warn,hickory_server::server::server_future=off,rmcp=warn,debug
   ```

3. Tail the proxy logs to see the added detail.

   {{< tabs >}}
   {{% tab name="Replace with your own" %}}
   ```sh
   kubectl logs -n <namespace> deploy/<gateway-name> -f
   ```
   {{% /tab %}}
   {{% tab name="Quickstart example" %}}
   ```sh
   kubectl logs -n agentgateway-system deploy/agentgateway-proxy -f
   ```
   {{% /tab %}}
   {{< /tabs >}}

### Controller logs

The agentgateway controller tracks a log level per component, such as the translator, syncer, and gateway controller.

1. Show the controller's current log level for each component. The `-n` flag defaults to `agentgateway-system`.

   ```sh
   agctl controller log -n agentgateway-system
   ```

   Example output (truncated):

   ```
   current log levels:
   ---
   agentgateway/syncer: info
   agentgateway/translator: info
   gateway-controller: info
   deployer: info
   default: info
   ```

2. Set the log level. Change all components at once with `--level`, or target a single component with `--set component=level`.

   ```sh
   # Set all components to debug
   agctl controller log -n agentgateway-system --level debug

   # Set a single component to debug
   agctl controller log -n agentgateway-system --set agentgateway/syncer=debug
   ```

3. Tail the controller logs.

   ```sh
   kubectl logs -n agentgateway-system deploy/agentgateway -f
   ```

> [!NOTE]
> You can also get and set the proxy log level directly through the `/logging` admin endpoint, such as `curl -X POST "http://localhost:15000/logging?level=debug"` after you port-forward to the proxy pod. The endpoint accepts the same `RUST_LOG` filter syntax for fine-grained, per-module levels, such as `info,proxy::httpproxy=trace`.

## Capture profiles

Agentgateway includes pprof endpoints to help you investigate CPU and memory issues. Use the `agctl proxy profile` commands to capture a profile. `agctl` resolves the proxy pod, opens the port-forward, reads the admin endpoint, and writes the profile to a file, so you do not need to manage `kubectl port-forward` yourself.

1. Optional: If you have not already, download [Graphviz](https://graphviz.org/download/) to visualize the profiles.

2. Capture a CPU profile. The default duration is 30 seconds. Send traffic through the gateway while the profile runs. Otherwise, the profile contains no samples.

   {{< tabs >}}
   {{% tab name="Replace with your own" %}}
   ```sh
   agctl proxy profile cpu gateway/<gateway-name> -n <namespace> --seconds 30 -o ./cpu.pprof
   ```
   {{% /tab %}}
   {{% tab name="Quickstart example" %}}
   ```sh
   agctl proxy profile cpu gateway/agentgateway-proxy -n agentgateway-system --seconds 30 -o ./cpu.pprof
   ```
   {{% /tab %}}
   {{< /tabs >}}

   Example output:

   ```
   Wrote cpu profile to ./cpu.pprof
   ```

3. Capture a heap profile.

   {{< tabs >}}
   {{% tab name="Replace with your own" %}}
   ```sh
   agctl proxy profile heap gateway/<gateway-name> -n <namespace> -o ./heap.pprof
   ```
   {{% /tab %}}
   {{% tab name="Quickstart example" %}}
   ```sh
   agctl proxy profile heap gateway/agentgateway-proxy -n agentgateway-system -o ./heap.pprof
   ```
   {{% /tab %}}
   {{< /tabs >}}

   Example output:

   ```
   Wrote heap profile to ./heap.pprof
   ```

   If you omit `-o`, `agctl` writes the profile to `agentgateway-cpu-<timestamp>.pb.gz` or `agentgateway-heap-<timestamp>.pb.gz` in the current directory.

4. Inspect the profiles with `go tool pprof`.

   **CPU profile**
   ```sh
   go tool pprof -http=: cpu.pprof
   ```

   **Heap profile**
   ```sh
   go tool pprof -http=: heap.pprof
   ```

   Graphviz opens on your web browser to a UI on localhost. Example:

   {{< reuse-image-light src="img/debug-heap-pprof.png" caption="Heap profile graph" >}}
   {{< reuse-image-dark srcDark="img/debug-heap-pprof.png" caption="Heap profile graph" >}}

> [!NOTE]
> To profile an agentgateway binary that runs on your workstation instead of a proxy pod, use `--local`, such as `agctl proxy profile heap --local`. Note that profiling data is available only when agentgateway runs on Linux. Proxy pods always meet this requirement, but a local macOS or Windows build does not: the CPU profile endpoint is not registered, so `agctl proxy profile cpu` fails with a `404 Not Found` error, and `agctl proxy profile heap` writes a profile that contains no allocation samples.
