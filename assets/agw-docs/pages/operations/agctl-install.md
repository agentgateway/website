Install `agctl`, the command-line tool that you use to inspect and debug agentgateway.

## About

`agctl` is the agentgateway command-line interface. Use `agctl` to inspect the configuration that an agentgateway proxy has loaded, capture detailed traces of requests as the proxy handles them, and manage proxy and controller log levels. The CLI works against agentgateway running in Kubernetes or as a standalone binary on your workstation.

`agctl` includes the following subcommands.

| Command | Description |
| -- | -- |
| `agctl proxy trace` | Capture a tap-style trace to analyze a copy of the next request that an agentgateway proxy handles. Renders the trace in an interactive, text-based terminal user interface (TUI) by default. Alternatively, you can format the output as JSON for piping to other tools. |
| `agctl proxy config` | Retrieve the runtime configuration that an agentgateway proxy has loaded, including binds, listeners, routes, backends, workloads, and services. |
| `agctl proxy log` | Get or set log levels for the agentgateway proxy at runtime. |
| `agctl controller log` | Get or set log levels for the agentgateway controller at runtime. |
| `agctl version` | Print version information for the `agctl` CLI. |
| `agctl completion` | Turn on autocompletion for your shell in `bash`, `zsh`, `fish`, or `powershell`. |

For a complete list of subcommands and flags, see the [`agctl` CLI reference]({{< link-hextra path="/reference/agctl/" >}}).

## Before you begin

Build `agctl` from source. Make sure that you have the following tools installed.

* [Go](https://go.dev/doc/install) 1.22 or later
* [Git](https://git-scm.com/downloads)
* [Graphviz](https://graphviz.org/download/) for profile investigation

## Install agctl

1. Clone the agentgateway repository.

   ```sh
   git clone https://github.com/agentgateway/agentgateway.git
   cd agentgateway
   ```

2. Build and install `agctl` to your `GOBIN` directory.

   ```sh
   go install ./controller/cmd/agctl
   ```

   By default, `go install` places the binary in `$(go env GOBIN)`, or in `$(go env GOPATH)/bin` if `GOBIN` is unset. Make sure that this directory is on your `PATH`.

   ```sh
   export PATH="$(go env GOPATH)/bin:$PATH"
   ```

3. Verify the install.

   ```sh
   agctl --help
   ```

   Example output:

   ```
   agctl controls and inspects Agentgateway resources

   Usage:
     agctl [command]

   Available Commands:
     completion  Generate the autocompletion script for the specified shell
     controller  Inspect and manage the Agentgateway controller
     help        Help about any command
     proxy       Inspect and manage the Agentgateway proxy
     version     Print agctl version information

   Flags:
     -h, --help                help for agctl
     -k, --kubeconfig string   kubeconfig

   Use "agctl [command] --help" for more information about a command.
   ```

## Enable shell completion

`agctl` ships with an autocompletion script for `bash`, `zsh`, `fish`, and `powershell`. Source the script for your shell to get tab-completion of subcommands, flags, and resource names.

{{< tabs >}}
{{% tab name="zsh" %}}
Add the completion script to a directory on your `$fpath`. The following example creates one and writes the script to it.

```sh
mkdir -p ~/.zsh/completions
agctl completion zsh > ~/.zsh/completions/_agctl
```

Add the directory to `$fpath` and load completion in your `~/.zshrc`.

```sh
fpath=(~/.zsh/completions $fpath)
autoload -U compinit && compinit
```
{{% /tab %}}
{{% tab name="bash" %}}
Source the script in your `~/.bashrc`.

```sh
echo 'source <(agctl completion bash)' >> ~/.bashrc
```
{{% /tab %}}
{{% tab name="fish" %}}
```sh
agctl completion fish > ~/.config/fish/completions/agctl.fish
```
{{% /tab %}}
{{% tab name="powershell" %}}
```powershell
agctl completion powershell | Out-String | Invoke-Expression
```
{{% /tab %}}
{{< /tabs >}}

## Upgrade agctl

To upgrade `agctl` to a newer version, pull the latest changes and rebuild.

```sh
cd agentgateway
git pull
go install ./controller/cmd/agctl
```

Verify the new version.

```sh
agctl --help
```

{{< callout type="info" >}}
Use the same `agctl` version as the agentgateway version that you run in your cluster. Slight skews within minor versions typically work, but compatibility across major versions is not guaranteed.
{{< /callout >}}

## Uninstall agctl

To uninstall `agctl`, remove the binary from your `GOBIN` directory.

```sh
rm "$(go env GOPATH)/bin/agctl"
```
