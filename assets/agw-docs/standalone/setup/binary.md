To run agentgateway as a standalone binary, follow the steps to download, install, and configure the binary on your local machine or server.

## Install the binary {#binary}

{{% steps %}}

### Download and install

{{< reuse "agw-docs/standalone/binary-install.md" >}}

### Verify the installation

Verify that the `agentgateway` binary is installed.

```shell
agentgateway --version
```

{{< reuse "agw-docs/standalone/binary-version-output.md" >}}

### Run agentgateway

Run the binary with no arguments to start agentgateway with a generated configuration file.

```sh
agentgateway
```

Agentgateway creates a `config.yaml` file in your user config directory, which is `$XDG_CONFIG_HOME/agentgateway` if that variable is set and `~/.config/agentgateway` otherwise. The generated file configures a `default` gateway on port 4000, attaches the admin UI to that gateway, and points agentgateway at a SQLite database in the same directory for local runtime features.

```yaml
# yaml-language-server: $schema=https://agentgateway.dev/schema/config
config:
  database:
    url: sqlite:///home/example/.config/agentgateway/data.db
gateways:
  default:
    port: 4000
ui:
  gateways: default
```

Agentgateway does not overwrite an existing file, so a later run reuses the configuration from the first one.

To run a configuration file of your own instead, pass it with the `-f` option. For a runnable starting point, try [this example configuration file](https://agentgateway.dev/examples/mcp-basic/config.yaml). Agentgateway watches the file and reloads it when you change it, so you do not need to restart the process to change a route or a policy. For more information, see [Update your configuration]({{< link-hextra path="/setup/update/" >}}).

```sh
agentgateway -f config.yaml
```

### Open the admin UI

The admin UI is a built-in web interface that runs alongside the proxy. Use it to review the configuration that agentgateway loaded and to manage your gateways, routes, LLM providers, and MCP servers without restarting the process.

Where agentgateway serves the UI depends on which of the two previous commands you ran.

* **Generated configuration**: The generated file attaches the UI to the `default` gateway, so the UI is served at <http://localhost:4000/ui>.
* **Your own configuration file**: A file that has no `ui` section serves the UI on the admin address, which defaults to <http://localhost:15000/ui>.

For more information, see [Launch the UI]({{< link-hextra path="/setup/ui/launch-ui/" >}}).

{{% /steps %}}

## Next steps

* [Set up the admin UI]({{< link-hextra path="/setup/ui/" >}}) to open, expose, and secure the web interface.
* [Choose where configuration is stored]({{< link-hextra path="/setup/storage/" >}}).
* [Update your configuration]({{< link-hextra path="/setup/update/" >}}) after agentgateway is running.
* [Upgrade agentgateway]({{< link-hextra path="/operations/upgrade/" >}}) to a new version.
