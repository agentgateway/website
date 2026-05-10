Use `agctl trace` to inspect the next request handled by agentgateway in real time. The command connects to the admin API and streams trace events — showing the route matched, policies applied, filters evaluated, and the final response — either in an interactive TUI or as raw JSONL.

## Before you begin

- Install `agctl`. See [Install agctl]({{< link-hextra path="/operations/agctl/" >}}).
- Have a running agentgateway instance.

## Trace a request

Run `agctl trace` to watch for the next incoming request. The command blocks until a request arrives, then renders the trace in an interactive TUI.

{{< tabs tabTotal="2" items="Kubernetes,Standalone" >}}
{{% tab tabName="Kubernetes" %}}

Watch for the next request on the auto-detected gateway pod:

```sh
agctl trace
```

Target a specific gateway resource:

```sh
agctl trace gateway/my-gateway
```

Watch in a specific namespace:

```sh
agctl trace gateway/my-gateway -n my-namespace
```

{{% /tab %}}
{{% tab tabName="Standalone" %}}

Trace against a local agentgateway instance:

```sh
agctl trace --local
```

If agentgateway is listening on a non-default admin port:

```sh
agctl trace --local --proxy-admin-port 15001
```

{{% /tab %}}
{{< /tabs >}}

## Trigger a request as part of the trace

Pass a URL after `--` to have `agctl` both enable tracing and send the request. Use `--port` to specify the gateway listener port.

{{< tabs tabTotal="2" items="Kubernetes,Standalone" >}}
{{% tab tabName="Kubernetes" %}}

```sh
agctl trace gateway/my-gateway --port 80 -- http://host/some/path
```

With additional curl arguments (for example, a bearer token):

```sh
agctl trace gateway/my-gateway --port 80 -- http://host/some/path -H "Authorization: Bearer sk-123"
```

{{% /tab %}}
{{% tab tabName="Standalone" %}}

```sh
agctl trace --local --port 8080 -- http://host/some/path
```

With additional curl arguments:

```sh
agctl trace --local --port 8080 -- http://host/some/path -H "Authorization: Bearer sk-123"
```

{{% /tab %}}
{{< /tabs >}}

## Output raw JSONL instead of the TUI

Use `--raw` to print trace events as newline-delimited JSON (JSONL) instead of opening the interactive TUI. This is useful for scripting or piping to tools like `jq`.

```sh
agctl trace --raw
agctl trace gateway/my-gateway --raw --port 80 -- http://host/some/path | jq .
```

## Reference

| Flag | Default | Description |
|------|---------|-------------|
| `-n, --namespace` | | Namespace to use when resolving resources. |
| `--proxy-admin-port` | `15000` | Agentgateway admin port. |
| `--raw` | `false` | Print trace events as JSONL instead of opening the TUI. |
| `--port` | | Gateway listener port to use when triggering a request. Required when a request URL is provided. |
| `--local` | `false` | Trace against a local agentgateway instance on `127.0.0.1`. Cannot be combined with a resource argument. |
