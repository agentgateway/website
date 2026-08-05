---
title: Debug your setup
description: Find and fix configuration and runtime problems in a standalone agentgateway using its admin endpoints and agctl.
weight: 15
---

Inspect and troubleshoot a standalone agentgateway instance through the admin endpoints and the [`agctl`]({{< link-hextra path="/operations/agctl" >}}) command-line tool.

## About

Agentgateway exposes an admin server on `127.0.0.1:15000` by default. The admin server provides the following endpoints for inspection and debugging.

| Endpoint | Description |
| -- | -- |
| `/config_dump` | Returns the runtime configuration that agentgateway has loaded, including binds, listeners, routes, backends, workloads, services, and policies. |
| `/debug/trace` | Streams a JSON-over-SSE trace of the next request that the proxy handles. The `agctl proxy trace` command consumes this endpoint. |
| `/logging` | Get and set the logging level at runtime. |
| `/memory` | Dump allocator and process memory statistics. |
| `/debug/pprof/profile` | Build a CPU profile by using the [pprof](https://github.com/google/pprof) profiler. Available on Linux builds only. Use `?seconds=N` to set the duration (1–300s, default 10s) and `?frequency=N` to set the sampling rate in Hz (1–1000, default 100). |
| `/debug/pprof/heap` | Collect heap profiling data. Contains allocation samples on Linux builds only. |
| `/debug/tasks` | Inspect the live tokio task tree. |
| `/quitquitquit` | Trigger a graceful shutdown of agentgateway. |

You can change the admin address by setting the top-level `adminAddr` field in your config file, such as the following.

```yaml
config:
  adminAddr: 127.0.0.1:16000
```

To inspect the proxy's configuration and to capture per-request traces, use the [`agctl`]({{< link-hextra path="/operations/agctl" >}}) command-line tool. `agctl` wraps the admin endpoints and renders their output in formats that are easier to scan than raw JSON.

## Inspect the loaded configuration

To dump the configuration that the running proxy has loaded, capture the JSON from the `/config_dump` endpoint and pass it to `agctl proxy config all`.

1. Save the proxy's config dump to a file.

   ```sh
   curl -s http://127.0.0.1:15000/config_dump > /tmp/agw-dump.json
   ```

2. Render it with `agctl`. Use `-o yaml` for a more readable view.

   ```sh
   agctl proxy config all --file /tmp/agw-dump.json -o yaml
   ```

For complete steps, see [Inspect agentgateway configuration]({{< link-hextra path="/operations/inspect-config" >}}).

## Trace requests

To capture a per-request trace as agentgateway processes it, use `agctl proxy trace`. The trace shows you the route that was selected, the policies that were applied, the backend that was chosen, and the response status. Tracing is invaluable for understanding why a request matched (or did not match) a route, why a policy was or was not applied, or why a request returned an unexpected status.

1. In one terminal, start a watch.

   ```sh
   agctl proxy trace --local
   ```

2. In another terminal, send a request.

   ```sh
   curl http://127.0.0.1:3000/headers
   ```

   `agctl` opens a text-based terminal user interface (TUI) that walks you through the request and response lifecycle. Use `--raw` to print JSON Lines instead.

For complete steps, including how to inject a request from `agctl` itself, see [Trace requests with agctl]({{< link-hextra path="/operations/trace-requests" >}}).

## Enable debug logs {#debug-logs}

Agentgateway uses the same level syntax as [`RUST_LOG`](https://docs.rs/env_logger/latest/env_logger/#enabling-logging): `error`, `warn`, `info`, `debug`, and `trace`. You can change the level at runtime through the `/logging` endpoint, or set it in your config file at startup.

{{< tabs >}}
{{% tab name="curl logging endpoint" %}}
Set the log level without restarting agentgateway. If you configured agentgateway to use a different admin address, update the host and port accordingly.

```sh
curl -X POST "http://localhost:15000/logging?level=debug"
```

Example output:

```
current log level is typespec_client_core::http::policies::logging=warn,hickory_server::server::server_future=off,rmcp=warn,debug
```
{{% /tab %}}
{{% tab name="config file" %}}
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

Agentgateway includes pprof endpoints to help you investigate CPU and memory issues. Use the `agctl proxy profile` commands to read those endpoints and write the profile to a file.

> [!IMPORTANT]
> Profiling data is available only when agentgateway runs on Linux. On macOS and Windows builds, the CPU profile endpoint is not registered, so `agctl proxy profile cpu` fails with a `404 Not Found` error, and `agctl proxy profile heap` writes a profile that contains no allocation samples.

1. Optional: If you have not already, download [Graphviz](https://graphviz.org/download/) to visualize the profiles.

2. Capture a CPU profile. The default duration is 30 seconds. Send traffic through agentgateway while the profile runs. Otherwise, the profile contains no samples.

   ```sh
   agctl proxy profile cpu --local --seconds 30 -o ./cpu.pprof
   ```

   Example output:

   ```
   Wrote cpu profile to ./cpu.pprof
   ```

3. Capture a heap profile.

   ```sh
   agctl proxy profile heap --local -o ./heap.pprof
   ```

   Example output:

   ```
   Wrote heap profile to ./heap.pprof
   ```

   If you omit `-o`, `agctl` writes the profile to `agentgateway-cpu-<timestamp>.pb.gz` or `agentgateway-heap-<timestamp>.pb.gz` in the current directory.

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

   {{< reuse-image-light src="img/debug-heap-pprof.png" caption="Heap profile graph" >}}
   {{< reuse-image-dark srcDark="img/debug-heap-pprof.png" caption="Heap profile graph" >}}

> [!NOTE]
> `agctl proxy profile` assumes that the admin server listens on port 15000. If you changed the admin address, pass the port with `-p`, such as `agctl proxy profile heap --local -p 16000`. You can also request the profiles directly from the admin endpoints, such as `curl -o cpu.pprof "http://127.0.0.1:15000/debug/pprof/profile?seconds=30"`. Use the endpoints directly when you want to set the sampling rate with the `frequency` parameter, which `agctl` does not expose.
