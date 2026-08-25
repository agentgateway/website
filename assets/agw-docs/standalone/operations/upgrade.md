## About

An upgrade replaces the agentgateway binary or image. It does not change your configuration, which lives in a file, a mounted volume, or a ConfigMap that the upgrade leaves alone. To change the configuration itself, see [Update your configuration]({{< link-hextra path="/setup/update/" >}}).

Every method requires a restart of the agentgateway process, because a new binary cannot replace a running one in place. Plan for a brief interruption in proxy traffic, or run more than one instance behind a load balancer.

## Before you begin

1. Review the [release notes highlights]({{< link path="/reference/release-notes/" >}}) and [GitHub release](https://github.com/agentgateway/agentgateway/releases) for the version that you are moving to.

2. **Optional**: Set the old version that you are on so that you can roll back to it, such as {{< reuse "agw-docs/versions/patch_n-1.md" >}} in the following example.

   ```sh
   agentgateway --version
   ```

   ```json
   {
     "version": "{{< reuse "agw-docs/versions/patch_n-1.md" >}}",
     ...
   }
   ```

   ```sh
   export OLD_VERSION={{< reuse "agw-docs/versions/patch_n-1.md" >}}
   ```

3. Set the new version that you want to upgrade to as an environment variable, such as {{< reuse "agw-docs/versions/patch_n+1.md" >}} in the following example.

   ```sh
   export NEW_VERSION={{< reuse "agw-docs/versions/patch_n+1.md" >}}
   ```

## Upgrade

The steps differ by installation method, because each method delivers the agentgateway binary in a different way.

### Binary {#binary}

Run the installation script again with the version that you want. The script detects the installed binary, replaces it, and leaves your configuration file untouched.

1. Check the version that you run today.

   ```sh
   agentgateway --version
   ```

   Example output:

   ```json
   {
     "version": "1.4.0",
     "git_revision": "90f7b25855fb5f5fbefcc16855206040cba9b77d",
     "rust_version": "1.89.0",
     "build_profile": "release",
     "build_target": "x86_64-unknown-linux-musl"
   }
   ```

2. Stop the running agentgateway process.

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

4. Verify the new version.

   ```sh
   agentgateway --version
   ```

5. Start agentgateway again with your configuration file.

   ```sh
   agentgateway -f config.yaml
   ```

### Docker {#docker}

Recreate the container from a new image tag, mounting the same configuration path. Your configuration file and any SQLite database in the mounted directory persist, because they live on the volume rather than in the container.

1. Pull the new image.

   ```sh
   docker pull cr.agentgateway.dev/agentgateway:{{< reuse "agw-docs/versions/image-tag.md" >}}
   ```

2. Stop and remove the running container. The configuration in your mounted directory is not affected.

   ```sh
   docker rm -f agentgateway
   ```

3. Start a container from the new tag, with the same mount and published ports that you used before.

   ```sh
   docker run -d --name agentgateway \
     --user "$(id -u):$(id -g)" \
     -v "$PWD/agentgateway-config:/config" \
     -p 4000:4000 \
     cr.agentgateway.dev/agentgateway:{{< reuse "agw-docs/versions/image-tag.md" >}}
   ```

4. Verify the version that the new container runs.

   ```sh
   docker exec agentgateway /app/agentgateway --version
   ```

5. Confirm that your configuration came through, such as by checking the effective configuration.

   ```sh
   curl -s http://localhost:4000/api/config/effective | jq
   ```

In Docker Compose, change the `image` tag in your `compose.yaml` file and recreate the service instead.

```sh
docker compose pull
docker compose up -d
```

### Helm {#helm}

Upgrade the chart version. The chart re-renders the ConfigMap from your Helm values and rolls the Deployment.

1. Check the chart version and app version that you run today.

   ```sh
   helm list -n {{< reuse "agw-docs/snippets/namespace.md" >}}
   ```

   Example output:

   ```txt
   NAME                    NAMESPACE           REVISION  STATUS    CHART                          APP VERSION
   agentgateway-standalone agentgateway-system 3         deployed  agentgateway-standalone-1.4.0  1.4.0
   ```

2. Upgrade the release to the new chart version.

   {{< tabs >}}
   {{% tab name="Upgrade version, reuse values" %}}
   ```sh
   helm upgrade -i {{< reuse "agw-docs/standalone/helm-standalone-release.md" >}} \
     {{< reuse "agw-docs/standalone/helm-standalone-chart-ref.md" >}} \
     --namespace {{< reuse "agw-docs/snippets/namespace.md" >}} \
     --reuse-values \
     --version {{< reuse "agw-docs/versions/helm-version-flag.md" >}}
   ```
   {{% /tab %}}
   {{% tab name="Upgrade version and values" %}}
   ```sh
   helm upgrade -i {{< reuse "agw-docs/standalone/helm-standalone-release.md" >}} \
     {{< reuse "agw-docs/standalone/helm-standalone-chart-ref.md" >}} \
     --namespace {{< reuse "agw-docs/snippets/namespace.md" >}} \
     --version {{< reuse "agw-docs/versions/helm-version-flag.md" >}} \
     -f values.yaml
   ```
   {{% /tab %}}
   {{< /tabs >}}

3. Watch the rollout.

   ```sh
   kubectl rollout status deploy/{{< reuse "agw-docs/standalone/helm-standalone-release.md" >}} \
     -n {{< reuse "agw-docs/snippets/namespace.md" >}}
   ```

4. Verify the new version.

   ```sh
   helm list -n {{< reuse "agw-docs/snippets/namespace.md" >}}
   ```

> [!IMPORTANT]
> `--reuse-values` keeps the values from the previous revision, which is what you want for a version-only upgrade. If you pass `-f values.yaml` instead, pass your complete values file, because a value that you leave out returns to its chart default. That includes `mode`, so an incomplete file can send a release in `database` mode back to read-only storage. For more information, see [Update your configuration]({{< link-hextra path="/setup/update/#helm" >}}).

Because the default `replicaCount` is `1`, expect a brief interruption in traffic during the rollout. To keep a pod serving traffic while the new pod starts, set `replicaCount` to a value greater than `1`.

## Rollback

Roll back to an earlier version.

> [!WARNING]
> Rolling back to an older version after agentgateway has written to a database can fail if the newer version changed the database schema. If you use `hybrid` storage mode, back up the database before you upgrade. For more information, see [Configuration storage]({{< link-hextra path="/setup/storage/" >}}).

{{< tabs >}}
{{% tab name="Binary" %}}
Run the script again with the version that you upgraded from.

```sh
curl -sL https://agentgateway.dev/install | bash -s -- --version v$OLD_VERSION
```
{{% /tab %}}
{{% tab name="Docker" %}}
Recreate the container from the previous tag. Because the configuration lives on the volume, no restore step is needed.

```sh
docker rm -f agentgateway
docker run -d --name agentgateway \
  --user "$(id -u):$(id -g)" \
  -v "$PWD/agentgateway-config:/config" \
  -p 4000:4000 \
  cr.agentgateway.dev/agentgateway:v$OLD_VERSION
```
{{% /tab %}}
{{% tab name="Helm" %}}
Helm keeps the history of the release, so you can return to the previous revision.

1. Review the revision history.

   ```sh
   helm history {{< reuse "agw-docs/standalone/helm-standalone-release.md" >}} \
     -n {{< reuse "agw-docs/snippets/namespace.md" >}}
   ```

2. Roll back to the revision that you want.

   ```sh
   helm rollback {{< reuse "agw-docs/standalone/helm-standalone-release.md" >}} <$REVISION> \
     -n {{< reuse "agw-docs/snippets/namespace.md" >}}
   ```
{{% /tab %}}
{{< /tabs >}}

## Next steps

* [Update your configuration]({{< link-hextra path="/setup/update/" >}}) to change agentgateway settings rather than the agentgateway version.
* [Inspect agentgateway configuration]({{< link-hextra path="/operations/inspect-config/" >}}) to confirm what the upgraded instance loaded.
* [Debug agentgateway]({{< link-hextra path="/operations/debug/" >}}) if the instance does not start after an upgrade.
