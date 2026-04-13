To run agentgateway as a standalone binary, follow the steps to download, install, and configure the binary on your local machine or server.

## Install the binary {#binary}

{{% steps %}}

### Step 1: Download and install

Download and install the agentgateway binary. Alternatively, you can manually download the binary from the [agentgateway releases page](https://github.com/agentgateway/agentgateway/releases/latest).

{{< tabs tabTotal="2" items="Latest, Specific version" >}}
{{% tab tabName="Latest" %}}

To install the latest release:

```sh
curl -sL https://agentgateway.dev/install | bash
```

{{% /tab %}}
{{% tab tabName="Specific version" %}}

To install a specific version, pass the `--version` flag. Use any release tag from the [agentgateway releases page](https://github.com/agentgateway/agentgateway/releases), such as the development version, `{{< reuse "agw-docs/versions/patch-dev.md" >}}`. The version must start with `v` (the script adds it if you omit it).

```sh
curl -sL https://agentgateway.dev/install | bash -s -- --version {{< reuse "agw-docs/versions/patch-dev.md" >}}
```

{{% /tab %}}
{{< /tabs >}}

Example output:

```
  % Total    % Received % Xferd  Average Speed   Time    Time     Time     Current
                                 Dload  Upload   Total   Spent   Left    Speed
100  8878  100  8878    0     0  68998      0 --:--:-- --:--:-- --:--:-- 69359

Downloading https://github.com/agentgateway/agentgateway/releases/download/v0.4.16/agentgateway-darwin-arm64
Verifying checksum... Done.
Preparing to install agentgateway into /usr/local/bin
Password:
agentgateway installed into /usr/local/bin/agentgateway
```

### Step 2: Verify the installation

Verify that the `agentgateway` binary is installed.

```shell
agentgateway --version
```

Example output with the latest version, {{< reuse "agw-docs/versions/n-patch.md" >}}:

```json
{
  "version": "{{< reuse "agw-docs/versions/n-patch.md" >}}",
  "git_revision": "90f7b25855fb5f5fbefcc16855206040cba9b77d",
  "rust_version": "1.89.0",
  "build_profile": "release",
  "build_target": "x86_64-unknown-linux-musl"
}
```

### Step 3: Create a configuration file

Create a [configuration file]({{< link-hextra path="/configuration/" >}}) for agentgateway. In this example, `config.yaml` is used. You might start with [this simple example configuration file](https://raw.githubusercontent.com/agentgateway/agentgateway/main/examples/basic/config.yaml).

```yaml
{{< github url="https://raw.githubusercontent.com/agentgateway/agentgateway/main/examples/basic/config.yaml" >}}
```

### Step 4: Run agentgateway

```sh
agentgateway -f config.yaml
```

Example output:

```
info  state_manager  loaded config from File("config.yaml")
info  app            serving UI at http://localhost:15000/ui
info  proxy::gateway started bind  bind="bind/3000"
```

{{% /steps %}}
