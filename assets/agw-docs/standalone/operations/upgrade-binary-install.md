3. Run the installation script with the target version. Replace `<version>` with any release tag from the [agentgateway releases page](https://github.com/agentgateway/agentgateway/releases), such as `v1.4.1`. The version must start with `v`, and the script adds it if you omit it.

   {{< tabs >}}
   {{% tab name="Specific version" %}}
   ```sh
   curl -sL https://agentgateway.dev/install | bash -s -- --version $NEW_VERSION
   ```
   {{% /tab %}}
   {{% tab name="Latest" %}}
   With no `--version` flag, the script installs the highest stable release, skipping drafts and pre-releases.

   ```sh
   curl -sL https://agentgateway.dev/install | bash
   ```
   {{% /tab %}}
   {{% tab name="Non-default installation directory" %}}
   The script writes to `/usr/local/bin` by default, and uses `sudo` to do it. To install somewhere else, set `AGENTGATEWAY_INSTALL_DIR`, and pass `--no-sudo` when that directory is already writable by your user.
   
   ```sh
   curl -sL https://agentgateway.dev/install | \
     AGENTGATEWAY_INSTALL_DIR="$HOME/.local/bin" bash -s -- --no-sudo --version $NEW_VERSION
   ```
   {{% /tab %}}
   {{< /tabs >}}

   Example output, where the script reports the change that it is about to make:

   ```txt
   agentgateway v1.4.1 is available. Changing from version 1.4.0.
   Downloading https://github.com/agentgateway/agentgateway/releases/download/v1.4.1/agentgateway-linux-amd64
   Verifying checksum... Done.
   Preparing to install agentgateway into /usr/local/bin
   agentgateway installed into /usr/local/bin/agentgateway
   ```

