Inspect the runtime configuration that a standalone agentgateway instance loaded by using `agctl proxy config`.

## About

`agctl proxy config` reads the agentgateway admin endpoint at `/config_dump` and renders the result as a structured table or as JSON or YAML. Use it to confirm what the proxy actually loaded, especially when a config change appears to apply but the proxy does not behave as expected.

For a standalone agentgateway instance, you provide the config dump as a file. `agctl proxy config` does not have a `--local` flag. Instead, capture the dump from the admin port and pass it to `agctl proxy config all --file <path>`.

`agctl proxy config` includes the following subcommands.

| Subcommand | What it returns |
| -- | -- |
| `agctl proxy config all` | The full runtime configuration: binds, listeners, routes, backends, workloads, services, and policies. |
| `agctl proxy config backends` | A table of backends and their endpoint health, request counts, and latency. Most useful in Kubernetes mode where xDS feeds the service list. |

## Before you begin

* [Install agctl]({{< link-hextra path="/documentation/operations/agctl" >}}).
* Have an agentgateway instance running locally, such as the [non-agentic HTTP quickstart]({{< link-hextra path="/documentation/quickstart/non-agentic-http" >}}) setup.

## Capture the config dump

Save the agentgateway admin endpoint's `/config_dump` output to a file.

```sh
curl -s http://127.0.0.1:15000/config_dump > /tmp/agw-dump.json
```

If you set a custom admin address in your config file, replace `127.0.0.1:15000` with the host and port that you configured.

## Render the full configuration

Render the dump as YAML, which is easier to scan than JSON.

```sh
agctl proxy config all --file /tmp/agw-dump.json -o yaml
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

## Use other output formats

`agctl proxy config all` accepts the `-o` flag with `short` (default), `json`, and `yaml` values. The `short` and `json` outputs both return the full pretty-printed configuration. Note that there is no compressed table view for the full configuration.

```sh
# Pretty-printed JSON
agctl proxy config all --file /tmp/agw-dump.json -o json

# YAML
agctl proxy config all --file /tmp/agw-dump.json -o yaml
```

## Pipe the output to other tools

Pipe the JSON output through tools like `jq` to extract specific fields. The following examples assume that you are running the standalone agentgateway example with a single bind on port `3000`.

```sh
# List route names
agctl proxy config all --file /tmp/agw-dump.json -o json | jq '.binds[].listeners[].routes[].name'

# Show only the backends
agctl proxy config all --file /tmp/agw-dump.json -o json | jq '.backends'
```

{{< version exclude-if="1.6.x,1.5.x,1.4.x,1.3.x,1.2.x,1.1.x,1.0.x" >}}
## Inspect managed resources with agctl {#agctl}

To list the configuration resources that the config resource API manages, use `agctl standalone get`.

```sh
agctl standalone get all
agctl standalone get llm.model -o yaml
agctl standalone get traffic.route -o yaml
```

The output shows the saved resource definitions. It does not show the runtime health of endpoints, or the translated configuration from the config dump. In hybrid mode, the output lists the resources from the database only. To investigate the configuration that the proxy loaded, use the config dump steps earlier on this page. For resource kinds and storage behavior, see [Manage config resources]({{< link-hextra path="/documentation/operations/config-resources/#agctl" >}}).
{{< /version >}}
