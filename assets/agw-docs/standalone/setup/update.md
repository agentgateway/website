Change the configuration of a running agentgateway instance. The steps differ by installation method, because each method delivers the configuration file to the proxy in a different way.

## About

In standalone mode, one configuration file is the source of truth for the proxy. Agentgateway watches that file and reloads it when the contents change, so most changes take effect without restarting the process.

```txt
INFO state_manager  Watching config file: /config/config.yaml
INFO state_manager  loaded config from File("/config/config.yaml")
```

Two things are worth knowing before you edit.

* **Not every field reloads.** The top-level `config` section holds startup settings, such as `adminAddr`, `storage`, `database`, `logging`, and `tracing`. Agentgateway applies those only when the process starts, with the exception of `config.modelCatalog`, which does reload. Everything else, including `gateways`, `routes`, `llm`, `mcp`, and `ui`, reloads in place. For more information, see [Fields that require a restart](#restart-required).
* **The UI may also write to this file.** In the default storage mode, agentgateway writes the resources that you manage in the admin UI back to the same file. Your file is an output as well as an input. To keep the file as the only writer, or to send UI edits to a database instead, see [Configuration storage]({{< link-hextra path="/setup/storage/" >}}).

## Binary {#binary}

Edit the file that you passed to `agentgateway -f`, or the generated file in your user config directory if you started agentgateway with no arguments.

1. Find the file that the running process loaded. Agentgateway logs the path on startup.

   ```txt
   INFO state_manager  loaded config from File("/home/example/.config/agentgateway/config.yaml")
   ```

2. Edit the file. The following example adds a route to the `default` gateway.

   ```yaml
   # yaml-language-server: $schema=https://agentgateway.dev/schema/config
   gateways:
     default:
       port: 4000
   routes:
   - matches:
     - path:
         pathPrefix: /
     backends:
     - host: httpbin.org:80
   ```

3. Save the file. Agentgateway reloads it, and logs the reload.

   ```txt
   INFO state_manager  loaded config from File("/home/example/.config/agentgateway/config.yaml")
   ```

4. Confirm that the running configuration includes your change. For more information, see [Verify an update](#verify).

> [!NOTE]
> Agentgateway rewatches the file when an editor replaces it rather than writing in place, which is what most editors do, so you do not need to restart after saving from an editor.

## Docker {#docker}

The container reads the configuration from the path that you mounted, so you edit the file on your host and the container picks it up.

1. Edit the file in the directory or at the path that you mounted. If you mounted a directory at `/config`, the file is `config.yaml` inside it.

   ```sh
   vi agentgateway-config/config.yaml
   ```

2. Save the file. Agentgateway reloads it inside the container. Check the container logs to confirm.

   ```sh
   docker logs <container-name> | tail -5
   ```

   Example output:

   ```txt
   INFO state_manager  loaded config from File("/config/config.yaml")
   ```

3. Confirm that the running configuration includes your change. For more information, see [Verify an update](#verify).

If you mounted the configuration read-only, or if the change is to the `config` section, restart the container instead.

```sh
docker restart <container-name>
```

## Helm {#helm}

With the Helm chart, you do not edit a file on the proxy. The `config` Helm value holds the entire agentgateway configuration file, and the chart renders it into the ConfigMap that the pod mounts. To change the configuration, change your values and upgrade the release.

> [!TIP]
> For possible agentgateway settings, check out the schema and interactive explorer tool in the [Configuration reference docs]({{< link-hextra path="/reference/configuration/" >}}).

1. Create or edit a Helm values file, such as `values.yaml`. Agentgateway's own top-level fields include a section that is also named `config`. That section ends up nested inside the `config` Helm value.

   ```yaml
   cat <<'EOF' > values.yaml
   config:                    # Helm value: the whole agentgateway configuration file
     gateways:                # agentgateway field
       default:
         port: 4000
     routes:
     - matches:
       - path:
           pathPrefix: /
       backends:
       - host: httpbin.httpbin.svc.cluster.local:8000
     config:                  # agentgateway field: agentgateway's own 'config' section
       logging:
         level: info
   EOF
   ```

2. Pass the file to Helm during the upgrade.

   {{< reuse "agw-docs/standalone/helm-upgrade-command.md" >}}

3. Confirm that the ConfigMap holds your change.

   ```sh
   kubectl get configmap {{< reuse "agw-docs/standalone/helm-standalone-release.md" >}}-config \
     -n {{< reuse "agw-docs/snippets/namespace.md" >}} -o jsonpath='{.data.config\.yaml}'
   ```

> [!IMPORTANT]
> The upgrade replaces the whole configuration file, not just the fields that you changed. A value that you leave out of the values file returns to its chart default, so pass your complete values file on every upgrade, or use `--reuse-values` to keep the values from the previous revision. In `database` storage mode, the upgrade replaces only the ConfigMap baseline, and the resources that the UI stored in the database are unaffected.

The Deployment stores a checksum of the ConfigMap in its pod annotations, so a change to your `config` values rolls out new pods rather than relying on the file watch. Because the default `replicaCount` is `1`, expect a brief interruption in traffic during the rollout. To keep a pod serving traffic while the new pod starts, set `replicaCount` to a value greater than `1`.

## Fields that require a restart {#restart-required}

The top-level `config` section is read at startup. If you change a field in it, agentgateway reloads the file but keeps running with the previous value, and the change takes effect only after the process restarts. For example, setting `config.storage.mode` on a running instance leaves the storage mode unchanged until you restart.

Restart agentgateway for the installation method that you use.

| Method | Restart |
| --- | --- |
| Binary | Stop the process and run `agentgateway -f config.yaml` again. |
| Docker | `docker restart <container-name>` |
| Helm | A `helm upgrade` that changes the rendered ConfigMap rolls the pods for you. To restart without a configuration change, run `kubectl rollout restart deploy/{{< reuse "agw-docs/standalone/helm-standalone-release.md" >}} -n {{< reuse "agw-docs/snippets/namespace.md" >}}`. |

`config.modelCatalog` is the exception. Agentgateway reloads the model cost catalog dynamically, so a catalog change does not need a restart.

## Verify an update {#verify}

Ask the running proxy what configuration it has loaded, rather than reading the file back. The admin API serves the effective configuration, which includes anything that a database overlay contributes in `hybrid` storage mode.

```sh
curl -s http://localhost:15000/api/config/effective | jq
```

For a Helm release, port-forward the admin address first.

```sh
kubectl port-forward -n {{< reuse "agw-docs/snippets/namespace.md" >}} \
  deploy/{{< reuse "agw-docs/standalone/helm-standalone-release.md" >}} 15000:15000
```

> [!NOTE]
> The admin API is served on the admin address, which defaults to `localhost:15000`. If you attached the UI to a gateway, the same API is available on that gateway's port. For more information, see [Admin UI]({{< link-hextra path="/setup/ui/" >}}).

To check a configuration file before you apply it, validate it without starting the proxy.

```sh
agentgateway --validate-only -f config.yaml
```

## Next steps

* [Configuration storage]({{< link-hextra path="/setup/storage/" >}}) to change whether the UI can write to your configuration.
* [Upgrade agentgateway]({{< link-hextra path="/operations/upgrade/" >}}) to a new agentgateway version.
* [Inspect agentgateway configuration]({{< link-hextra path="/operations/inspect-config/" >}}) to see what a running instance loaded.
