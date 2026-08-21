Choose where agentgateway stores the configuration that you manage in the admin UI.

## About

Agentgateway always reads a configuration file at startup. What the `storage` setting controls is what happens when something *writes* configuration back, such as when you add an MCP server in the admin UI or send a request to the config resource API.

### Storage modes

Set the mode in the `config.storage.mode` field of your configuration file. Because the field is in the `config` section, agentgateway applies it at startup only, so a change to it takes effect after a restart.

```yaml
# yaml-language-server: $schema=https://agentgateway.dev/schema/config
config:
  storage:
    mode: hybrid          # file, hybrid, or readOnly
  database:
    url: sqlite:///config/data.db   # required only in hybrid mode
gateways:
  default:
    port: 4000
ui:
  gateways: default
```

Review the following table to understand this configuration.

| Mode | What a write does | Requires a database |
| --- | --- | --- |
| `file` (default) | Agentgateway writes the resource into your configuration file, adding the section if the file does not have one yet. | No |
| `hybrid` | Agentgateway keeps your configuration file as a read-only baseline and stores the resource in the database. At read time, it merges the stored resources over the baseline. | Yes |
| `readOnly` | Agentgateway rejects the write with a `403` response and the message `UI is configured as read-only`. | No |

In `hybrid` mode, agentgateway never writes back to your configuration file. Instead, it stores the resource in the database and layers it over the file value when it reads the configuration. That is what makes the mode useful for a read-only file, and it is also why the file remains the place to change anything that the UI does not manage, such as a gateway or a listener.

### What the database stores

The database holds only the resource types in the following table. Everything else in the configuration file, such as the `config` section and the structure of the file itself, comes from your configuration file.

| Area | Resource types that the database can store |
| --- | --- |
| LLM | Providers, models, virtual models, API keys, and policies |
| MCP | Targets, policies, and settings |
| Traffic | Gateways, routes, and TCP routes |
| UI | Policies and the model catalog |

### How each installation method differs

The mode you want depends on whether your configuration file is writable, which is a property of how you installed agentgateway.

| Method | Configuration file | Default behavior |
| --- | --- | --- |
| [Binary]({{< link-hextra path="/setup/install/binary/" >}}) | A local file, writable. | `file` mode. UI edits are saved to your file. A generated configuration also sets a SQLite database for local runtime features, so `hybrid` mode needs no extra setup. |
| [Docker]({{< link-hextra path="/setup/install/docker/" >}}) | A mounted file or directory, writable unless you mount it read-only. | `file` mode. UI edits are saved to the file on your host. |
| [Helm]({{< link-hextra path="/setup/install/helm/" >}}) | A ConfigMap that the chart renders from your values and mounts read-only. | The chart sets `file` mode, and because the mount is read-only, a UI save fails. Set the chart's `mode` value to `database` to switch to `hybrid` and store edits in PostgreSQL. |

## Binary and Docker {#binary-docker}

With the binary and Docker installations, your configuration file is writable, so the default `file` mode works with no extra setup and the admin UI can save your changes.

### Save UI edits to your configuration file {#file-mode}

No configuration is needed for this mode, because `file` is the default. The following steps confirm the behavior and show what agentgateway writes.

1. Confirm the storage mode that the running instance uses.

   ```sh
   curl -s http://localhost:15000/api/runtime | jq '.ui.configStoreMode'
   ```

   Example output:

   ```txt
   "file"
   ```

2. Add an MCP server. You can use the admin UI, or send the same request that the UI sends when you save a server.

   ```sh
   curl -s -X PUT http://localhost:15000/api/config/resources/mcp.target \
     -H 'Content-Type: application/json' \
     -d '{"resources":[{"value":{"name":"my-target","mcp":{"host":"http://example.com/mcp"}}}]}'
   ```

3. Review your configuration file. Agentgateway added the server, and created the `mcp` section because the file did not have one.

   ```yaml
   # yaml-language-server: $schema=https://agentgateway.dev/schema/config
   gateways:
     default:
       port: 4000
   ui:
     gateways: default
   mcp:
     targets:
     - name: my-target
       mcp:
         host: http://example.com/mcp
   ```

Agentgateway preserves the schema comment at the top of the file, and reloads the file after it writes to it.

> [!IMPORTANT]
> In this mode the UI is a writer of your configuration file, not only a reader. If you keep your configuration in version control, or if you generate it from another tool, use `readOnly` or `hybrid` mode so that a UI edit cannot overwrite it.

### Store UI edits in a database {#binary-hybrid}

Use `hybrid` mode when you want the configuration file to stay exactly as you wrote it, and UI edits to persist somewhere else. Agentgateway accepts a `postgres://` or `postgresql://` URL for PostgreSQL, and treats any other value as a SQLite database path.

1. Set the storage mode and a database URL in your configuration file. A generated configuration already has the `database` field, which points at a SQLite file next to the configuration file. In that case, you add only the `storage` field.

   ```yaml
   # yaml-language-server: $schema=https://agentgateway.dev/schema/config
   config:
     storage:
       mode: hybrid
     database:
       url: sqlite:///config/data.db
   gateways:
     default:
       port: 4000
   ui:
     gateways: default
   ```

2. Restart agentgateway. The `config` section is applied at startup, so the new mode does not take effect until the process restarts. For more information, see [Fields that require a restart]({{< link-hextra path="/setup/update/#restart-required" >}}).

3. Confirm the storage mode.

   ```sh
   curl -s http://localhost:15000/api/runtime | jq '.ui.configStoreMode'
   ```

   Example output:

   ```txt
   "hybrid"
   ```

4. Add an MCP server, in the UI or through the config resource API.

   ```sh
   curl -s -X PUT http://localhost:15000/api/config/resources/mcp.target \
     -H 'Content-Type: application/json' \
     -d '{"resources":[{"value":{"name":"persisted-target","mcp":{"host":"http://example.com/mcp"}}}]}'
   ```

   Agentgateway returns the stored resource, with the revision and timestamps that it tracks in the database.

   ```json
   {"resources":[{"kind":"mcp.target","id":"persisted-target","value":{"name":"persisted-target","mcp":{"host":"http://example.com/mcp"}},"revision":1,"createdAt":"2026-08-21T21:51:21.951418797Z","updatedAt":"2026-08-21T21:51:21.951418797Z"}]}
   ```

5. Confirm that your configuration file is unchanged, and that the effective configuration includes the server anyway. Agentgateway merges the stored resource over the file.

   ```sh
   curl -s http://localhost:15000/api/config/effective | jq -c '.mcp'
   ```

   Example output:

   ```json
   {"targets":[{"name":"persisted-target","mcp":{"host":"http://example.com/mcp"}}]}
   ```

6. Restart agentgateway again, then confirm that the server is still stored.

   ```sh
   curl -s http://localhost:15000/api/config/resources | jq '.resources[].id'
   ```

   Example output:

   ```txt
   "persisted-target"
   ```

### Reject UI edits {#binary-readonly}

Use `readOnly` mode when your configuration file is the only source of truth and you want the UI to be a viewer.

1. Set the mode in your configuration file.

   ```yaml
   # yaml-language-server: $schema=https://agentgateway.dev/schema/config
   config:
     storage:
       mode: readOnly
   gateways:
     default:
       port: 4000
   ui:
     gateways: default
   ```

2. Restart agentgateway, then confirm the mode.

   ```sh
   curl -s http://localhost:15000/api/runtime | jq '.ui.configStoreMode'
   ```

   Example output:

   ```txt
   "readOnly"
   ```

3. Confirm that a write is rejected.

   ```sh
   curl -s -X PUT http://localhost:15000/api/config/resources/mcp.target \
     -H 'Content-Type: application/json' \
     -d '{"resources":[{"value":{"name":"rejected","mcp":{"host":"http://example.com/mcp"}}}]}' \
     -w "\nHTTP %{http_code}\n"
   ```

   Example output:

   ```txt
   "UI is configured as read-only"
   HTTP 403
   ```

The UI still shows the running configuration in this mode. Only writes are rejected.

## Helm {#helm}

With the Helm chart, the configuration file is a ConfigMap that the chart renders from your Helm values and mounts read-only at the `/config` path. The proxy reads that file at startup, and the Helm values remain the source of truth.

Read-only storage keeps the deployment reproducible, but it also means that the admin UI cannot save anything. A save returns the following error, because write access to the mounted ConfigMap is denied.

```txt
failed to write to file `/config/config.yaml`: Read-only file system (os error 30)
```

To let the UI store configuration, connect a PostgreSQL instance to your agentgateway pod and switch the Helm chart to database mode. Agentgateway then treats the ConfigMap as a baseline and keeps UI-managed resources in the database. When you make updates to these resources in the UI, agentgateway merges the resources from the database with the baseline in the ConfigMap.

### Chart modes

| Chart `mode` | Storage mode | Configuration source | UI saves |
| --- | --- | --- | --- |
| `readonly` (default) | `file` | The Helm values that you provide to configure agentgateway. The values are translated and stored in a ConfigMap that is mounted to the agentgateway pod. | Config is read-only. UI updates are rejected. |
| `database` | `hybrid` | The ConfigMap as a baseline, with an overlay in PostgreSQL. | Updates to resources that are editable in the UI are stored in the database. |

Everything that you put in your Helm values is part of the baseline, including the fields that you can later edit in the UI. In `database` mode, agentgateway never writes back to the ConfigMap. Instead, it stores your UI edit in the database and layers it over the baseline value when it reads the configuration.

To choose a mode, set the chart's `mode` value. Do not set the `config.storage.mode` or `config.database.url` fields in your Helm values, because the chart derives both fields from `mode` and overwrites anything that you set for them. The chart also rejects a `mode` value other than `readonly` or `database`.

> [!IMPORTANT]
> Even in database mode, you cannot save the configuration file as a whole in the UI's configuration editor, because the mounted file itself remains read-only. Treat your Helm values as the source of truth for the file, and the UI as the way to manage the resources that are layered on top of it.

### Sections must exist in the ConfigMap

Adding a capability in the UI adds a section to the configuration file, and in the Helm installation that file is read-only. So although the database can store the resources *within* a section, the UI cannot add the section itself.

Consider the `mcp` section. The following Helm values let you add MCP servers in the UI, because the `mcp` section exists for agentgateway to store targets in.

```yaml
config:
  mcp:
    targets: []
```

Without that section, the UI navigation shows only **MCP** > **Get started**, and clicking **Enable MCP** fails with the following error, because enabling the capability requires adding the section to the file. The same is true for **LLM** and **Enable LLM**.

```txt
File configuration is read-only in hybrid mode. Copy the diff and update the configuration file directly.
```

To manage a capability in the UI, include an empty section for it in your Helm values, as shown in the **Storage settings and UI sections** tab in the following steps.

> [!NOTE]
> This constraint is specific to a read-only configuration file. In the binary and Docker installations, the file is writable, so the UI can add a section itself.

### Before you begin

1. [Install the standalone Helm chart]({{< link-hextra path="/setup/install/helm/" >}}).
2. Have a PostgreSQL instance available, or deploy one as shown in the following steps.

### Deploy PostgreSQL

For a production deployment, use a managed PostgreSQL instance or an operator that handles backups and failover. The following example deploys a single instance for testing.

> [!WARNING]
> This example stores the database on an `emptyDir` volume, so the data exists only for the lifetime of the PostgreSQL pod. If that pod restarts or is rescheduled, the configuration that you saved in the UI is lost, and agentgateway falls back to the ConfigMap baseline. For anything beyond testing, back the database with a PersistentVolumeClaim, or use a managed PostgreSQL instance.

1. Create a Secret for the database credentials. The following example creates the `agw` user with a `password` password.

   ```sh
   kubectl create secret generic agentgateway-postgres \
     -n {{< reuse "agw-docs/snippets/namespace.md" >}} \
     --from-literal=POSTGRES_USER=agw \
     --from-literal=POSTGRES_PASSWORD='password' \
     --from-literal=POSTGRES_DB=agw
   ```

2. Deploy PostgreSQL.

   ```sh
   kubectl apply -n {{< reuse "agw-docs/snippets/namespace.md" >}} -f - <<'EOF'
   apiVersion: apps/v1
   kind: Deployment
   metadata:
     name: postgres
   spec:
     replicas: 1
     selector:
       matchLabels:
         app: postgres
     template:
       metadata:
         labels:
           app: postgres
       spec:
         containers:
         - name: postgres
           image: postgres:{{< reuse "agw-docs/versions/postgres.md" >}}
           envFrom:
           - secretRef:
               name: agentgateway-postgres
           env:
           - name: PGDATA
             value: /var/lib/postgresql/data/pgdata
           ports:
           - containerPort: 5432
           volumeMounts:
           - name: data
             mountPath: /var/lib/postgresql/data
         volumes:
         - name: data
           emptyDir: {}
   ---
   apiVersion: v1
   kind: Service
   metadata:
     name: postgres
   spec:
     selector:
       app: postgres
     ports:
     - port: 5432
       targetPort: 5432
   EOF
   ```

3. Verify that PostgreSQL is running.

   ```sh
   kubectl rollout status deploy/postgres -n {{< reuse "agw-docs/snippets/namespace.md" >}}
   ```

### Switch to database mode

1. Set the `mode` value to `database` and provide the connection URL in your Helm values file. Agentgateway creates the schema that it needs on first startup, so no migration step is required. You can optionally preset `llm` and `mcp` sections so that you can edit in the UI later.

   {{< tabs >}}
   {{% tab name="Storage settings" %}}
   Switch the release to database mode without changing which capabilities the UI can manage. Use this option when you manage the configuration file in Helm values and use the database only to persist the resources for the sections that you already define.

   ```yaml
   cat <<'EOF' > values.yaml
   mode: database
   database:
     postgres:
       url: postgres://agw:password@postgres.{{< reuse "agw-docs/snippets/namespace.md" >}}.svc.cluster.local:5432/agw
   EOF
   ```
   {{% /tab %}}
   {{% tab name="Storage settings and UI sections" %}}
   Switch the release to database mode and add empty `llm` and `mcp` sections so that the UI can manage models, providers, and MCP servers. Agentgateway stores the resources that you add to these sections in the database, so the sections stay empty in your Helm values.

   ```yaml
   cat <<'EOF' > values.yaml
   mode: database
   database:
     postgres:
       url: postgres://agw:password@postgres.{{< reuse "agw-docs/snippets/namespace.md" >}}.svc.cluster.local:5432/agw
   config:
     gateways:
       default:
         port: 4000
     llm:
       providers: []
       models: []
       virtualModels: []
     mcp:
       targets: []
     routes:
     - matches:
       - path:
           pathPrefix: /
       backends:
       - host: httpbin.httpbin.svc.cluster.local:8000
   EOF
   ```

   Because neither section sets `gateways`, agentgateway attaches the LLM and MCP routes to the gateway that is named `default`. To serve them on another gateway, such as a gateway that you restrict to internal clients, set `gateways` in each section, such as `gateways: [internal]`.
   {{% /tab %}}
   {{< /tabs >}}

   > [!NOTE]
   > The chart rejects a `database.postgres.url` value that does not begin with `postgres://` or `postgresql://`, and rejects the value entirely when `mode` is `readonly`. The URL is rendered into the ConfigMap, so use a database user with only the privileges that agentgateway needs.

2. Upgrade the release with your values file.

   {{< reuse "agw-docs/standalone/helm-upgrade-command.md" >}}

3. Port-forward the admin address.

   ```sh
   kubectl port-forward -n {{< reuse "agw-docs/snippets/namespace.md" >}} \
     deploy/{{< reuse "agw-docs/standalone/helm-standalone-release.md" >}} 15000:15000
   ```

4. Confirm that agentgateway now runs in hybrid storage mode.

   ```sh
   curl -s http://localhost:15000/api/runtime | jq '.ui.configStoreMode'
   ```

   Example output:

   ```txt
   "hybrid"
   ```

### Add configuration in the UI

Now that storage is writable, add an MCP server. The admin UI and the config resource API write to the same place, so use whichever you prefer.

> [!NOTE]
> The admin UI steps require the `mcp` section from the **Storage settings and UI sections** tab in the previous step. For more information, see [Sections must exist in the ConfigMap](#sections-must-exist-in-the-configmap). The API steps work with either set of values, because the API creates the section for you when it stores the first MCP target.

{{< tabs >}}
{{% tab name="Admin UI" %}}
1. Open the [admin UI](http://localhost:15000/ui) in your browser.

2. In the navigation, click **MCP** > **Servers**, then click **Add server**.

3. Enter a **Server name**, such as `persisted-target`, keep the **Streamable HTTP** transport, and enter the **URL** of your MCP server, such as `http://example.com/mcp`.

   {{< reuse-image src="img/agentgateway-ui-storage-add-server.png" srcDark="img/agentgateway-ui-storage-add-server-dark.png" >}}

4. Click **Save server**. Agentgateway confirms with **Configuration saved** and lists the server. The save succeeds only because storage is writable. In the default read-only mode, the same action fails.

   {{< reuse-image src="img/agentgateway-ui-storage-server-saved.png" srcDark="img/agentgateway-ui-storage-server-saved-dark.png" >}}
{{% /tab %}}
{{% tab name="API" %}}
Send the same request that the UI sends when you save a server. The request is a `PUT` to the config resource API for the `mcp.target` resource type, and its body is the list of MCP targets that you want that resource type to hold. Agentgateway writes the targets in the body to the database, replacing any `mcp.target` resources that it stored before, and merges them over the `mcp` section in the ConfigMap. The following example stores one target that is named `persisted-target` and that proxies to an MCP server at `http://example.com/mcp`.

```sh
curl -s -X PUT http://localhost:15000/api/config/resources/mcp.target \
  -H 'Content-Type: application/json' \
  -d '{"resources":[{"value":{"name":"persisted-target","mcp":{"host":"http://example.com/mcp"}}}]}'
```
{{% /tab %}}
{{< /tabs >}}

### Verify that configuration persists

1. Review the effective configuration. Agentgateway merges the database overlay over the ConfigMap baseline, so the server appears alongside the routes that you set in your Helm values.

   ```sh
   curl -s http://localhost:15000/api/config/effective | jq
   ```

   Example output: Notice that your MCP server configuration is part of the merged config.

   ```json
   "mcp": {
     "targets": [
       {
         "mcp": {
           "host": "http://example.com/mcp"
         },
         "name": "persisted-target"
       }
     ]
   },
   ```

2. Restart the agentgateway pod.

   ```sh
   kubectl rollout restart deploy/{{< reuse "agw-docs/standalone/helm-standalone-release.md" >}} \
     -n {{< reuse "agw-docs/snippets/namespace.md" >}}
   ```

   ```sh
   kubectl rollout status deploy/{{< reuse "agw-docs/standalone/helm-standalone-release.md" >}} \
     -n {{< reuse "agw-docs/snippets/namespace.md" >}}
   ```

3. Port-forward the admin address again, then confirm that the server is still available, even after the restart. You can also refresh **MCP** > **Servers** in the UI and see it still listed.

   ```sh
   kubectl port-forward -n {{< reuse "agw-docs/snippets/namespace.md" >}} \
     deploy/{{< reuse "agw-docs/standalone/helm-standalone-release.md" >}} 15000:15000
   ```

   ```sh
   curl -s http://localhost:15000/api/config/resources | jq '.resources[].id'
   ```

   Example output:

   ```txt
   "persisted-target"
   ```

### Scale the deployment

Both storage modes support running more than one agentgateway proxy pod. In `readonly` mode, every agentgateway pod reads the same ConfigMap. In `database` mode, every agentgateway pod reads the same overlay from PostgreSQL, so a change that you make in the UI reaches all of them.

1. Add the `replicaCount` value to the values file that you created earlier, and set it to the number of agentgateway pods that you want to run. Keep the rest of your values, because the upgrade command passes the whole file and a value that you leave out returns to its default, which would send the release back to read-only storage.

   ```yaml
   replicaCount: 3
   mode: database
   database:
     postgres:
       url: postgres://agw:password@postgres.{{< reuse "agw-docs/snippets/namespace.md" >}}.svc.cluster.local:5432/agw
   config:
     gateways:
       default:
         port: 4000
     llm:
       providers: []
       models: []
       virtualModels: []
     mcp:
       targets: []
     routes:
     - matches:
       - path:
           pathPrefix: /
       backends:
       - host: httpbin.httpbin.svc.cluster.local:8000
   ```

2. Upgrade the release with your values file.

   {{< reuse "agw-docs/standalone/helm-upgrade-command.md" >}}

3. Verify that the deployment scaled to three agentgateway pods.

   ```sh
   kubectl get pods -n {{< reuse "agw-docs/snippets/namespace.md" >}} \
     -l app.kubernetes.io/name=agentgateway-standalone
   ```

## Cleanup

{{< reuse "agw-docs/snippets/cleanup.md" >}}

{{< tabs >}}
{{% tab name="Binary and Docker" %}}
1. Remove the MCP target that you created.

   ```sh
   curl -s -X DELETE http://localhost:15000/api/config/resources/mcp.target/persisted-target
   ```

2. Remove the `storage` field from your configuration file, and restart agentgateway to return to the default `file` mode.
{{% /tab %}}
{{% tab name="Helm" %}}
1. Remove the MCP target that you created.

   ```sh
   kubectl port-forward -n {{< reuse "agw-docs/snippets/namespace.md" >}} \
     deploy/{{< reuse "agw-docs/standalone/helm-standalone-release.md" >}} 15000:15000
   ```

   ```sh
   curl -s -X DELETE http://localhost:15000/api/config/resources/mcp.target/persisted-target
   ```

2. Return the release to read-only storage.

   ```sh
   helm upgrade -i {{< reuse "agw-docs/standalone/helm-standalone-release.md" >}} \
     {{< reuse "agw-docs/standalone/helm-standalone-chart-ref.md" >}} \
     --namespace {{< reuse "agw-docs/snippets/namespace.md" >}} \
     --version {{< reuse "agw-docs/versions/helm-version-flag.md" >}} \
     --set mode=readonly
   ```

3. Delete PostgreSQL and its Secret.

   ```sh
   kubectl delete deploy/postgres svc/postgres secret/agentgateway-postgres \
     -n {{< reuse "agw-docs/snippets/namespace.md" >}}
   ```
{{% /tab %}}
{{< /tabs >}}
