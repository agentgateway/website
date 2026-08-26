Download and install the agentgateway binary. Alternatively, you can manually download the binary from the [agentgateway releases page](https://github.com/agentgateway/agentgateway/releases/latest).

{{< tabs >}}
{{% tab name="Latest" %}}

To install the latest release:

```sh
curl -sL {{< reuse "agw-docs/standalone/install-url.md" >}} | bash
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
curl -sL {{< reuse "agw-docs/standalone/install-url.md" >}} | bash -s -- --version v{{< reuse "agw-docs/versions/release-tag.md" >}}
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
