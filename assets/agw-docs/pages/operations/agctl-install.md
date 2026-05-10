`agctl` is the CLI tool for controlling and debugging agentgateway. Use it to inspect configuration, trace live requests, and interact with running gateway instances.

## Install agctl

Download the `agctl` binary for your platform from the [agentgateway releases page](https://github.com/agentgateway/agentgateway/releases).

{{< tabs tabTotal="3" items="Linux,macOS,Windows" >}}
{{% tab tabName="Linux" %}}

```sh
curl -sL https://github.com/agentgateway/agentgateway/releases/latest/download/agctl-linux-amd64 -o agctl
chmod +x agctl
sudo mv agctl /usr/local/bin/agctl
```

{{% /tab %}}
{{% tab tabName="macOS" %}}

```sh
# Intel
curl -sL https://github.com/agentgateway/agentgateway/releases/latest/download/agctl-darwin-amd64 -o agctl

# Apple Silicon
curl -sL https://github.com/agentgateway/agentgateway/releases/latest/download/agctl-darwin-arm64 -o agctl

chmod +x agctl
sudo mv agctl /usr/local/bin/agctl
```

{{% /tab %}}
{{% tab tabName="Windows" %}}

Download `agctl-windows-amd64.exe` from the [releases page](https://github.com/agentgateway/agentgateway/releases) and add it to your `PATH`.

{{% /tab %}}
{{< /tabs >}}

## Verify the installation

```sh
agctl --help
```

Example output:

```
agctl controls and inspects Agentgateway resources

Usage:
  agctl [command]

Available Commands:
  config      Retrieve Agentgateway configuration for a resource
  trace       Trace the next request handled by an Agentgateway pod or local instance
  help        Help about any command

Flags:
  -h, --help   help for agctl
```

## Upgrade agctl

To upgrade, download the new binary from the [releases page](https://github.com/agentgateway/agentgateway/releases) and replace the existing binary following the same steps as installation.

## Commands

| Command | Description |
|---------|-------------|
| [`agctl config`](#agctl-config) | Retrieve agentgateway configuration for a resource. |
| [`agctl trace`]({{< link-hextra path="/operations/agctl-trace/" >}}) | Trace the next request handled by an agentgateway pod or local instance. |

### agctl config

Retrieve the current configuration from a running agentgateway instance.

```sh
# All configuration
agctl config all

# Backend configuration only
agctl config backends
```

| Flag | Default | Description |
|------|---------|-------------|
| `-n, --namespace` | | Namespace for resource resolution. |
| `-f, --file` | | Path to an agentgateway config dump JSON file. |
| `--proxy-admin-port` | `15000` | Admin port. |
| `-o, --output` | `short` | Output format: `short`, `json`, or `yaml`. |
