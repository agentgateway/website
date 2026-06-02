---
title: Debug your setup
weight: 15
---

Inspect and troubleshoot a standalone agentgateway instance through the admin endpoints and the [`agctl`]({{< link-hextra path="/operations/agctl" >}}) command-line tool.

## About

Agentgateway exposes an admin server on `127.0.0.1:15000` by default. The admin server provides the following endpoints for inspection and debugging.

| Endpoint | Description |
| -- | -- |
| `/config_dump` | Returns the runtime configuration that agentgateway has loaded, including binds, listeners, routes, backends, workloads, services, and policies. |
| `/debug/trace` | Streams a JSON-over-SSE trace of the next request that the proxy handles. The `agctl trace` command consumes this endpoint. |
| `/logging` | Get and set the logging level at runtime. |
| `/memory` | Dump allocator and process memory statistics. |
| `/debug/pprof/profile` | Build a CPU profile by using the [pprof](https://github.com/google/pprof) profiler. Use `?seconds=N` to set the duration (1–300s, default 10s). |
| `/debug/pprof/heap` | Collect heap profiling data. |
| `/debug/tasks` | Inspect the live tokio task tree. |
| `/quitquitquit` | Trigger a graceful shutdown of agentgateway. |

You can change the admin address by setting the top-level `adminAddr` field in your config file, such as the following.

```yaml
config:
  adminAddr: 127.0.0.1:16000
```

To inspect the proxy's configuration and to capture per-request traces, use the [`agctl`]({{< link-hextra path="/operations/agctl" >}}) command-line tool. `agctl` wraps the admin endpoints and renders their output in formats that are easier to scan than raw JSON.

## Inspect the loaded configuration

To dump the configuration that the running proxy has loaded, capture the JSON from the `/config_dump` endpoint and pass it to `agctl config all`.

1. Save the proxy's config dump to a file.

   ```sh
   curl -s http://127.0.0.1:15000/config_dump > /tmp/agw-dump.json
   ```

2. Render it with `agctl`. Use `-o yaml` for a more readable view.

   ```sh
   agctl config all --file /tmp/agw-dump.json -o yaml
   ```

For complete steps, see [Inspect agentgateway configuration]({{< link-hextra path="/operations/inspect-config" >}}).

## Trace requests

To capture a per-request trace as agentgateway processes it, use `agctl trace`. The trace shows you the route that was selected, the policies that were applied, the backend that was chosen, and the response status. Tracing is invaluable for understanding why a request matched (or did not match) a route, why a policy was or was not applied, or why a request returned an unexpected status.

1. In one terminal, start a watch.

   ```sh
   agctl trace --local
   ```

2. In another terminal, send a request.

   ```sh
   curl http://127.0.0.1:3000/headers
   ```

   `agctl` opens a text-based terminal user interface (TUI) that walks you through the request and response lifecycle. Use `--raw` to print JSON Lines instead.

For complete steps, including how to inject a request from `agctl` itself, see [Trace requests with agctl]({{< link-hextra path="/operations/trace-requests" >}}).

## Enable debug logs {#debug-logs}

Agentgateway uses the same level syntax as [`RUST_LOG`](https://docs.rs/env_logger/latest/env_logger/#enabling-logging): `error`, `warn`, `info`, `debug`, and `trace`. You can change the level at runtime through the `/logging` endpoint, or set it in your config file at startup.

{{< tabs tabTotal="2" items="curl logging endpoint,config file" >}}
{{% tab tabName="curl logging endpoint" %}}
Set the log level without restarting agentgateway. If you configured agentgateway to use a different admin address, update the host and port accordingly.

```sh
curl -X POST "http://localhost:15000/logging?level=debug"
```

Example output:

```
current log level is typespec_client_core::http::policies::logging=warn,hickory_server::server::server_future=off,rmcp=warn,debug
```
{{% /tab %}}
{{% tab tabName="config file" %}}
Set the log level permanently. Agentgateway reads the value at startup.

```yaml
config:
  logging:
    level: debug
    # optional: default is text
    format: json
```
{{% /tab %}}
{{< /tabs >}}

The agentgateway process now writes `debug` log lines, such as the following.

```
2026-02-12T16:11:25.493503Z	debug	proxy::httpproxy	request before normalization: Request { method: OPTIONS, uri: /sse?sessionId=...
```

You can also set fine-grained levels per module by using the same `RUST_LOG` filter syntax, such as `info,proxy::httpproxy=trace`.

## Capture profiles

Agentgateway includes pprof endpoints to help you investigate CPU and memory issues.

1. Optional: If you have not already, download [Graphviz](https://graphviz.org/download/) to visualize the profiles.

2. Capture a CPU profile. The default duration is 10 seconds; the example uses 30 seconds.

   ```sh
   curl -o cpu.pprof "http://127.0.0.1:15000/debug/pprof/profile?seconds=30"
   ```

3. Capture a heap profile.

   ```sh
   curl -o heap.pprof http://127.0.0.1:15000/debug/pprof/heap
   ```

4. Inspect the profile with `go tool pprof`.

   **CPU profile**
   ```sh
   go tool pprof -http=: cpu.pprof
   ```

   **Heap profile**
   ```sh
   go tool pprof -http=: heap.pprof
   ```

   Graphviz opens on your web browser to a UI on localhost. Example:

   {{< reuse-image src="img/debug-heap-pprof.png" caption="Heap profile graph" >}}
   {{< reuse-image-dark srcDark="img/debug-heap-pprof.png" caption="Heap profile graph" >}}
