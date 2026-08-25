To run agentgateway as a standalone binary, follow the steps to download, install, and configure the binary on your local machine or server.

## Install the binary {#binary}

{{% steps %}}

### Download and install

Download and install the agentgateway binary. Alternatively, you can manually download the binary from the [agentgateway releases page](https://github.com/agentgateway/agentgateway/releases/latest).

{{< tabs >}}
{{% tab name="Latest" %}}

To install the latest release:

```sh
curl -sL https://agentgateway.dev/install | bash
```

Example output:

```console
  % Total    % Received % Xferd  Average Speed   Time    Time     Time     Current
                                 Dload  Upload   Total   Spent   Left    Speed
100  8878  100  8878    0     0  68998      0 --:--:-- --:--:-- --:--:-- 69359

Downloading https://github.com/agentgateway/agentgateway/releases/download/v{{< reuse "agw-docs/versions/release-tag.md" >}}/agentgateway-darwin-arm64
Verifying checksum... Done.
Preparing to install agentgateway into /usr/local/bin
Password:
agentgateway installed into /usr/local/bin/agentgateway
```

{{% /tab %}}
{{% tab name="Specific version" %}}

To install a specific version, pass the `--version` flag. Use any release tag from the [agentgateway releases page](https://github.com/agentgateway/agentgateway/releases), such as `v{{< reuse "agw-docs/versions/release-tag.md" >}}`. The version must start with `v` (the script adds the `v` if you omit it).

```sh
curl -sL https://agentgateway.dev/install | bash -s -- --version v{{< reuse "agw-docs/versions/release-tag.md" >}}
```

{{% /tab %}}
{{% tab name="Nightly build" %}}
A nightly build has no release tag and is not listed on the releases page. Instead, each nightly build is a run of the nightly GitHub Actions workflow, and you download the binary from that run's artifacts.

1. Go to the [nightly builds in GitHub Actions](https://github.com/agentgateway/agentgateway/actions/workflows/nightly.yml) and click the run that you want to install from.
2. Copy the run ID from the end of that run's URL, such as `24873456345` in `https://github.com/agentgateway/agentgateway/actions/runs/24873456345`.
3. Using the `gh` CLI, download the binary artifact for your OS. The following example uses macOS. For other operating systems, replace `release-binary-mac` with `release-binary-linux`, `release-binary-linux-arm`, or `release-binary-windows`.

   ```sh
   gh run download 24873456345 -R agentgateway/agentgateway -n release-binary-mac
   ```

4. Make the binary file executable and move it to your binary location, such as in the following example.
   
   ```sh
   chmod +x agentgateway
   sudo mv agentgateway /usr/local/bin/agentgateway
   ```

5. Verify that you have the nightly build. The version string of a nightly build is `0.0.0-alpha.<commit>`, not a release tag.

   ```sh
   agentgateway --version
   ```

   Example output:
   ```json
   {
     "version": "0.0.0-alpha.813d7d0",
     "git_revision": "813d7d0ab4757db7c8ed5a639bc63c0bb20ac116",
     "rust_version": "1.95.0",
     "build_profile": "release",
     "build_target": "aarch64-apple-darwin"
   }
   ```

{{% /tab %}}
{{< /tabs >}}

### Verify the installation

Verify that the `agentgateway` binary is installed.

```shell
agentgateway --version
```

Example output with the latest release, {{< reuse "agw-docs/versions/release-tag.md" >}}:

```json
{
  "version": "{{< reuse "agw-docs/versions/release-tag.md" >}}",
  "git_revision": "90f7b25855fb5f5fbefcc16855206040cba9b77d",
  "rust_version": "1.89.0",
  "build_profile": "release",
  "build_target": "x86_64-unknown-linux-musl"
}
```

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
