Inspect the runtime configuration that a standalone agentgateway instance has loaded by using `agctl config`.

## About

`agctl config` reads the agentgateway admin endpoint at `/config_dump` and renders the result as a structured table or as JSON or YAML. Use it to confirm what the proxy actually loaded, especially when a config change appears to apply but the proxy does not behave as expected.

For a standalone agentgateway instance, you provide the config dump as a file. `agctl config` does not have a `--local` flag. Instead, capture the dump from the admin port and pass it to `agctl config --file <path>`.

`agctl config` includes the following subcommands.

| Subcommand | What it returns |
| -- | -- |
| `agctl config all` | The full runtime configuration: binds, listeners, routes, backends, workloads, services, and policies. |
| `agctl config backends` | A table of backends and their endpoint health, request counts, and latency. Most useful in Kubernetes mode where xDS feeds the service list. |

## Before you begin

* [Install agctl]({{< link-hextra path="/operations/agctl" >}}).
* Have an agentgateway instance running locally, such as the [non-agentic HTTP quickstart]({{< link-hextra path="/quickstart/non-agentic-http" >}}) setup.

## Steps

{{% steps %}}

### Step 1: Capture the config dump

Save the agentgateway admin endpoint's `/config_dump` output to a file.

```sh
curl -s http://127.0.0.1:15000/config_dump > /tmp/agw-dump.json
```

If you set a custom admin address in your config file, replace `127.0.0.1:15000` with the host and port that you configured.

### Step 2: Render the full configuration

Render the dump as YAML, which is easier to scan than JSON.

```sh
agctl config all --file /tmp/agw-dump.json -o yaml
```

Example output (truncated):

```yaml
backends:
- backend:
    host:
      name: default/default/bind/3000/listener0/default/httpbin/backend0
      namespace: ""
      target: 127.0.0.1:8000
binds:
- address: '[::]:3000'
  key: bind/3000
  listeners:
    default/default/bind/3000/listener0:
      gatewayName: default
      gatewayNamespace: default
      hostname: ""
      key: default/default/bind/3000/listener0
      listenerName: listener0
      protocol: HTTP
      routes:
        default/default/bind/3000/listener0/default/httpbin:
          backends:
          - backend: /default/default/bind/3000/listener0/default/httpbin/backend0
            weight: 1
          key: default/default/bind/3000/listener0/default/httpbin
          matches:
          - path:
              pathPrefix: /
          name: httpbin
          namespace: default
...
```

The output includes the agentgateway version, build info, and all loaded `binds`, `listeners`, `routes`, `backends`, and `policies`. Use it to confirm that your config file loaded as expected.

### Step 3: Use other output formats

`agctl config all` accepts the `-o` flag with `short` (default), `json`, and `yaml` values.

```sh
# Pretty-printed JSON
agctl config all --file /tmp/agw-dump.json -o json

# YAML
agctl config all --file /tmp/agw-dump.json -o yaml
```

{{< callout type="note" >}}
For `agctl config all`, the `short` and `json` outputs both return the full pretty-printed configuration. There is no compressed table view today.
{{< /callout >}}

### Step 4: Pipe the output to other tools

Pipe the JSON output through tools like `jq` to extract specific fields. The following examples assume that you are running the standalone agentgateway example with a single bind on port `3000`.

```sh
# List route names
agctl config all --file /tmp/agw-dump.json -o json | jq '.binds[].listeners[].routes[].name'

# Show only the backends
agctl config all --file /tmp/agw-dump.json -o json | jq '.backends'
```

{{% /steps %}}

## Troubleshooting

### `error: no Gateways found in namespace "default"`

**What's happening**: `agctl config all` (without `--file`) returns this error.

**Why it's happening**: When you do not pass `--file`, `agctl config` looks for a Gateway resource in your active Kubernetes context. There is no `--local` mode for `config`.

**How to fix it**: Capture the dump from the admin endpoint and pass it with `--file`.

```sh
curl -s http://127.0.0.1:15000/config_dump > /tmp/agw-dump.json
agctl config all --file /tmp/agw-dump.json -o yaml
```

### `agctl config backends` shows an empty table

**What's happening**: `agctl config backends --file dump.json` prints only the header.

**Why it's happening**: The `services` field of the config dump is fed by xDS in Kubernetes mode. In standalone mode, agentgateway routes to static `host` backends and does not populate `services`, so the backends table is empty.

**How to fix it**: To inspect static backends in standalone mode, use `agctl config all` and look at the `backends` array, or grep for `host:` in the YAML output.

## What's next

* [Trace requests with agctl]({{< link-hextra path="/operations/trace-requests" >}}).
* [Debug your setup]({{< link-hextra path="/operations/debug" >}}).
