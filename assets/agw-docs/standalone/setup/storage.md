## About

Agentgateway always reads a configuration file at startup. To control how configuration updates are persisted while agentgateway is running, such as when you use the admin UI or send a request to the config resource API, decide on your storage mode.

### Storage modes

Set the mode in the `config.storage.mode` field of your configuration file. The mode values are `file`, `hybrid`, and `readOnly`, which are the literal values that the field accepts. Because the field is in the `config` section, agentgateway applies it at startup only, so a change to it takes effect after a restart.

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

In `hybrid` mode, agentgateway never writes back to your configuration file. Instead, it stores the resource in the database that you configure in the admin UI or API, and layers it over the file value when it reads the configuration. Note that you can only update certain resources through the admin UI or API. For more information, see [What the database stores](#what-the-database-stores).

> [!NOTE]
> The Helm chart uses its own `mode` value with the names `readonly` and `database`, which the chart translates into the `file` and `hybrid` values of `config.storage.mode`. For more information, see [Helm](#helm).

### What the database stores

The database holds only the resource types in the following table. Everything else in the configuration file, such as the `config` section and the structure of the file itself, comes from your configuration file.

| Area | Resource types that the database can store |
| --- | --- |
| LLM | Providers, models, virtual models, API keys, and policies |
| MCP | Targets, policies, and settings |
| Traffic | Gateways, routes, and TCP routes |
| UI | Policies and the model catalog |

The overlay only adds resources. It does not replace a resource that your configuration file already defines. For example, in `hybrid` mode you can add a gateway in the UI, and agentgateway serves it alongside the gateways in your file. But if the resource that you store has the same name as one in your file, agentgateway rejects the write with a `409` response.

```txt
"config resource traffic.gateway/default conflicts with file-owned resource"
```

To change a resource that your configuration file already defines, or to change a field that the database cannot hold, such as anything in the top-level `config` section, edit the configuration file that agentgateway reads at startup.

### How each installation method differs

All three modes are available in all three installation methods, because the mode is a field in the same configuration file that every method reads. What differs is whether that file is writable, and how you set the mode.

| Method | Configuration file | Default behavior |
| --- | --- | --- |
| [Binary]({{< link-hextra path="/setup/install/binary/" >}}) | A local file, writable. | `file` mode. UI edits are saved to your file. A generated configuration also sets a SQLite database for local runtime features, so `hybrid` mode needs no extra setup. |
| [Docker]({{< link-hextra path="/setup/install/docker/" >}}) | A mounted file or directory, writable unless you mount it read-only. | `file` mode. UI edits are saved to the file on your host. `hybrid` mode requires an additional database setup. |
| [Helm]({{< link-hextra path="/setup/install/helm/" >}}) | A ConfigMap that the chart renders from your values and mounts read-only. | The chart sets `file` mode, and because the mount is read-only, a UI save fails. Set the chart's `mode` value to `database` to switch to `hybrid` and store edits in [PostgreSQL](#deploy-postgresql). |

In the binary and Docker installations, you set `config.storage.mode` in your file, so all three modes are available to you directly. In the Helm installation, the chart derives `config.storage.mode` from its own `mode` value and overwrites anything that you set for the field yourself, so the chart offers `file` and `hybrid` storage only.

## Binary and Docker {#binary-docker}

With the binary and Docker installations, your configuration file is writable, so the default `file` mode works with no extra setup and the admin UI can save your changes.

### `file` mode {#file-mode}

Use `file` mode when you want the admin UI to save your changes into the same configuration file that you edit by hand. No configuration is needed for this mode, because `file` is the default. The following steps confirm the behavior and show what agentgateway writes.

1. Confirm the storage mode that the running instance uses.

   ```sh
   curl -s http://localhost:15000/api/runtime | jq '.ui.configStoreMode'
   ```

   Example output:

   ```txt
   "file"
   ```

2. Add an MCP server. The admin UI and the config resource API write to the same place, so use whichever you prefer.

   {{< tabs >}}
   {{% tab name="Admin UI" %}}
   1. Open the [admin UI](http://localhost:15000/ui) in your browser.

   2. In the navigation, click **MCP**. If your configuration file has no `mcp` section yet, the entry is **Get started**. Click it, then click **Enable** to have agentgateway add the section to your file. If the file already has an `mcp` section, the entry is **Servers** instead and you can skip this step.

   3. On the **MCP Servers** page, click **Add server**.

   4. Enter a **Server name**, such as `my-target`, keep the **Streamable HTTP** transport, and enter the **URL** of your MCP server, such as `http://example.com/mcp`.

      {{< reuse-image src="img/agentgateway-ui-storage-file-add-server.png" srcDark="img/agentgateway-ui-storage-file-add-server-dark.png" >}}

   5. Click **Save server**. Agentgateway writes the server into your configuration file, reloads the file, and confirms with **Configuration saved**.

      {{< reuse-image src="img/agentgateway-ui-storage-file-saved.png" srcDark="img/agentgateway-ui-storage-file-saved-dark.png" >}}
   {{% /tab %}}
   {{% tab name="API" %}}
   Send the same request that the UI sends when you save a server. The request is a `PUT` to the config resource API for the `mcp.target` resource type, and its body is the list of MCP targets that you want that resource type to hold.

   ```sh
   curl -s -X PUT http://localhost:15000/api/config/resources/mcp.target \
     -H 'Content-Type: application/json' \
     -d '{"resources":[{"value":{"name":"my-target","mcp":{"host":"http://example.com/mcp"}}}]}'
   ```
   {{% /tab %}}
   {{< /tabs >}}

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

   > [!NOTE]
   > If you enabled MCP in the UI, the `mcp` section also has a `port` field, because **Enable** writes the capability's default port along with the empty `targets` list.

Agentgateway preserves the schema comment at the top of the file, and reloads the file after it writes to it.

> [!IMPORTANT]
> In this mode the UI is a writer of your configuration file, not only a reader. If you keep your configuration in version control, or if you generate it from another tool, use `readOnly` or `hybrid` mode so that a UI edit cannot overwrite it.

### `hybrid` mode {#binary-hybrid}

Use `hybrid` mode when you want the configuration file to stay exactly as you wrote it, and UI edits to persist somewhere else. Agentgateway accepts a `postgres://` or `postgresql://` URL for PostgreSQL, and treats any other value as a SQLite database path.

1. Set the storage mode and a database URL in your configuration file. A generated configuration already has the `database` field, which points at a SQLite file next to the configuration file. In that case, you add only the `storage` field.

   The example also adds an empty `mcp` section. In `hybrid` mode agentgateway treats your file as a read-only baseline, so the UI cannot add a section to it, only resources within a section that already exists. For more information, see [Sections must exist in the file](#sections-must-exist).

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
   mcp:
     targets: []
   ```

2. Restart agentgateway. The `config` section is applied at startup, so the new mode does not take effect until the process restarts. For more information, see [Fields that require a restart]({{< link-hextra path="/setup/update/#restart-required" >}}).

   {{< tabs >}}
   {{% tab name="Binary" %}}
   Stop the current process, such as with `ctrl+c`, then start it again.

   ```sh
   agentgateway -f config.yaml
   ```
   {{% /tab %}}
   {{% tab name="Docker" %}}
   ```sh
   docker restart <container-name>
   ```
   {{% /tab %}}
   {{< /tabs >}}

3. Confirm the storage mode.

   ```sh
   curl -s http://localhost:15000/api/runtime | jq '.ui.configStoreMode'
   ```

   Example output:

   ```txt
   "hybrid"
   ```

4. Add an MCP server. The admin UI and the config resource API write to the same place, so use whichever you prefer.

   {{< tabs >}}
   {{% tab name="Admin UI" %}}
   1. Open the [admin UI](http://localhost:15000/ui) in your browser.

   2. In the navigation, click **MCP** > **Servers**, then click **Add server**.

   3. Enter a **Server name**, such as `persisted-target`, keep the **Streamable HTTP** transport, and enter the **URL** of your MCP server, such as `http://example.com/mcp`.

      {{< reuse-image src="img/agentgateway-ui-storage-add-server.png" srcDark="img/agentgateway-ui-storage-add-server-dark.png" >}}

   4. Click **Save server**. Agentgateway stores the server in the database, leaves your configuration file untouched, and confirms with **Configuration saved**.

      {{< reuse-image src="img/agentgateway-ui-storage-server-saved.png" srcDark="img/agentgateway-ui-storage-server-saved-dark.png" >}}

   > [!NOTE]
   > The navigation offers **Servers** only because your configuration file already has an `mcp` section. Without it, the entry is **Get started**, and clicking **Enable** fails with `File configuration is read-only in hybrid mode`. For more information, see [Sections must exist in the file](#sections-must-exist).
   {{% /tab %}}
   {{% tab name="API" %}}
   Send the same request that the UI sends when you save a server.

   ```sh
   curl -s -X PUT http://localhost:15000/api/config/resources/mcp.target \
     -H 'Content-Type: application/json' \
     -d '{"resources":[{"value":{"name":"persisted-target","mcp":{"host":"http://example.com/mcp"}}}]}'
   ```

   Agentgateway returns the stored resource, with the revision and timestamps that it tracks in the database.

   ```json
   {"resources":[{"kind":"mcp.target","id":"persisted-target","value":{"name":"persisted-target","mcp":{"host":"http://example.com/mcp"}},"revision":1,"createdAt":"2026-08-21T21:51:21.951418797Z","updatedAt":"2026-08-21T21:51:21.951418797Z"}]}
   ```
   {{% /tab %}}
   {{< /tabs >}}

5. Confirm that your configuration file is unchanged. The `mcp` section is still the empty one that you wrote, because agentgateway stored the server in the database instead of adding it here. In `file` mode, the same save would have appended the target to this list.

   ```sh
   cat config.yaml
   ```

   Example output:

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
   mcp:
     targets: []
   ```

6. Confirm that the effective configuration includes the server anyway. Agentgateway merges the stored resource over the file.

   ```sh
   curl -s http://localhost:15000/api/config/effective | jq -c '.mcp'
   ```

   Example output:

   ```json
   {"targets":[{"name":"persisted-target","mcp":{"host":"http://example.com/mcp"}}]}
   ```

7. Restart agentgateway again, then confirm that the server is still stored.

   ```sh
   curl -s http://localhost:15000/api/config/resources | jq '.resources[].id'
   ```

   Example output:

   ```txt
   "persisted-target"
   ```

### `readOnly` mode {#binary-readonly}

Use `readOnly` mode when your configuration file is the only source of truth and you want the UI to have read access only.

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

In a Helm installation, you do not set `config.storage.mode` yourself. Instead, you set the chart's `mode` value, and the chart renders the equivalent agentgateway storage mode into the ConfigMap for you.

| Chart `mode` | Equivalent storage mode | Configuration source | UI saves |
| --- | --- | --- | --- |
| `readonly` (default) | `file` | The Helm values that you provide to configure agentgateway. The values are translated and stored in a ConfigMap that is mounted to the agentgateway pod. | Config is read-only. UI updates are rejected. |
| `database` | `hybrid` | The ConfigMap as a baseline, with an overlay in PostgreSQL. | Updates to resources that are editable in the UI are stored in the database. |

Everything that you put in your Helm values is part of the baseline, including the fields that you can later edit in the UI. In `database` mode, agentgateway never writes back to the ConfigMap. Instead, it stores your UI edit in the database and layers it over the baseline value when it reads the configuration.

To choose a mode, set the chart's `mode` value. Do not set the `config.storage.mode` or `config.database.url` fields in your Helm values, because the chart derives both fields from `mode` and overwrites anything that you set for them. The chart also rejects a `mode` value other than `readonly` or `database`.

> [!IMPORTANT]
> Even in database mode, you cannot save the configuration file as a whole in the UI's configuration editor, because the mounted file itself remains read-only. Treat your Helm values as the source of truth for the file, and the UI as the way to manage the resources that are layered on top of it.

### Sections must exist in the file {#sections-must-exist}

Adding a capability in the UI adds a section to the configuration file, and in `hybrid` mode agentgateway never writes that file. Although the database can store the resources within a section, the UI cannot add the section itself.

Without a pre-existing section in the config for MCPs, LLMs, or gateways, the UI navigation shows a **Get started** path, but clicking **Enable** fails with the following error, because enabling the capability requires adding the section to the file.

```txt
File configuration is read-only in hybrid mode. Copy the diff and update the configuration file directly.
```

To allow the UI to configure sections in your configuration file, you must define these sections in your Helm values file, even if they are empty, as shown in the following example and in the following steps.

```yaml
config:
  mcp:
    targets: []
```

> [!NOTE]
> This constraint comes from `hybrid` mode, not from the read-only mount, so it applies to a binary or Docker installation in `hybrid` mode as well. Only `file` mode lets the UI add a section, because only `file` mode writes to your configuration file.

### Deploy PostgreSQL {#deploy-postgresql}

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
> The admin UI steps require the `mcp` section from the **Storage settings and UI sections** tab in the previous step. For more information, see [Sections must exist in the file](#sections-must-exist). The API steps work with either set of values, because the API creates the section for you when it stores the first MCP target.

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
     -l app.kubernetes.io/name={{< reuse "agw-docs/standalone/helm-standalone-chart-name.md" >}}
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
