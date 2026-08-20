In this guide, you deploy PostgreSQL, switch the chart to database mode, and verify that configuration that you add in the UI survives a restart.

## About

By default, the chart renders your Helm values into a ConfigMap and mounts it read-only at `/config`. The proxy reads that file at startup, and the Helm values remain the source of truth for the configuration.


Read-only storage keeps the deployment reproducible, but it also means that the admin UI cannot save anything. A save returns the following error, because the mounted ConfigMap cannot be written.

```txt
failed to write to file `/config/config.yaml`: Read-only file system (os error 30)
```

To let the UI store configuration, run PostgreSQL and switch the chart to database mode. Agentgateway then treats the ConfigMap as a baseline and keeps UI-managed resources in the database, merging the two when it reads the configuration.

### Chart modes

| Chart `mode` | Storage mode | Configuration source | UI saves |
| --- | --- | --- | --- |
| `readonly` (default) | `file` | The ConfigMap that the chart renders from your Helm values. | Rejected. |
| `database` | `hybrid` | The ConfigMap as a baseline, with an overlay in PostgreSQL. | Stored in the database. |

The chart sets `config.storage.mode` and `config.database.url` for you based on the `mode` value, and overwrites anything that you set for those two fields directly. Set `mode` instead.

### What the database stores

The database holds only the resources that the UI manages. Everything else, such as gateways, listeners, and routes, comes from your Helm values.

| Stored in the database | Stored in the ConfigMap |
| --- | --- |
| MCP targets, policies, and settings | Gateways and listeners |
| LLM providers, models, virtual models, API keys, and policies | Routes and backends |
| Traffic gateways, routes, and TCP routes | The `config` section, such as logging and storage |
| UI policies and the model catalog | Authentication policies that you set in Helm values |

> [!IMPORTANT]
> Saving the configuration file as a whole still fails in database mode, because the file itself remains read-only. Treat your Helm values as the source of truth for the file, and the UI as the way to manage the resources layered on top of it.

The database stores the resources within a configuration section, not the section itself. For example, agentgateway stores an MCP target in the database, but the `mcp` section that contains the target must already exist in the ConfigMap. Adding a section changes the file, so the UI cannot add one in database mode. **Enable LLM** and **Enable MCP** fail with the following error.

```txt
File configuration is read-only in hybrid mode. Copy the diff and update the configuration file directly.
```

The UI navigation also lists the pages for a capability only when the configuration includes its section. Until then, the **LLM** and **MCP** sections each show a single **Get started** link. To manage a capability in the UI, include an empty section for it in your Helm values, as shown in the following steps.

## Before you begin

1. [Install the standalone Helm chart]({{< link-hextra path="/deployment/helm/install/" >}}).
2. Have a PostgreSQL instance available, or deploy one as shown in the following steps.

## Deploy PostgreSQL

For a production deployment, use a managed PostgreSQL instance or an operator that handles backups and failover. The following example deploys a single instance for testing.

1. Create a Secret for the database credentials. The following example creates `agw / password` credentials

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
           image: postgres:16-alpine
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

## Switch to database mode

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

3. Port-forward the admin interface.

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

## Add configuration in the UI

Now that storage is writable, add an MCP server. The Admin UI and the config resource API write to the same place, so use whichever you prefer.

> [!NOTE]
> The Admin UI steps require the `mcp` section from the **Storage settings and UI sections** tab in the previous step. Without that section, the navigation shows only **MCP** > **Get started**, and **Enable MCP** fails because it changes the read-only file. The API creates the section for you when it stores the first MCP target, so you can use the API with either set of values.

{{< tabs >}}
{{% tab name="Admin UI" %}}
1. Open <http://localhost:15000/ui> in your browser.

2. In the navigation, click **MCP** > **Servers**, then click **Add server**.

3. Enter a **Server name**, such as `persisted-target`, keep the **Streamable HTTP** transport, and enter the **URL** of your MCP server, such as `http://example.com/mcp`.

   {{< reuse-image-light src="img/agentgateway-ui-storage-add-server.png" >}}
   {{< reuse-image-dark srcDark="img/agentgateway-ui-storage-add-server-dark.png" >}}

4. Click **Save server**. Agentgateway confirms with **Configuration saved** and lists the server. The save succeeds only because storage is writable. In the default read-only mode, the same action fails.

   {{< reuse-image-light src="img/agentgateway-ui-storage-server-saved.png" >}}
   {{< reuse-image-dark srcDark="img/agentgateway-ui-storage-server-saved-dark.png" >}}
{{% /tab %}}
{{% tab name="API" %}}
Send the same request that the UI sends.

```sh
curl -s -X PUT http://localhost:15000/api/config/resources/mcp.target \
  -H 'Content-Type: application/json' \
  -d '{"resources":[{"value":{"name":"persisted-target","mcp":{"host":"http://example.com/mcp"}}}]}'
```
{{% /tab %}}
{{< /tabs >}}

## Verify that configuration persists

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

3. Port-forward the admin interface again, then confirm that the server survived the restart. You can also refresh **MCP** > **Servers** in the UI and see it still listed.

   ```sh
   kubectl port-forward -n agentgateway-system \
     deploy/agentgateway-standalone 15000:15000
   ```

   ```sh
   curl -s http://localhost:15000/api/config/resources | jq '.resources[].id'
   ```

   Example output:

   ```txt
   "persisted-target"
   ```

## Scale the deployment

Both modes support more than one replica. In `readonly` mode, every replica reads the same ConfigMap. In `database` mode, every replica reads the same overlay, so a change that you make in the UI reaches all of them.

```yaml
replicaCount: 3
```

<!--TODO troubleshooting left hidden for now

## Troubleshooting

| Symptom | Cause |
| --- | --- |
| The pod does not start, and the logs report a database connection error. | The connection URL, credentials, or network policy prevents the pod from reaching PostgreSQL. Agentgateway requires the database at startup in `database` mode. |
| The UI reports `Read-only file system` when you save. | The release still runs in `readonly` mode, or you tried to save the configuration file as a whole rather than a resource that the UI manages. |
| Resources disappear after an upgrade. | An upgrade replaces the ConfigMap, not the database. Confirm that the resource is one that the UI manages, and that `mode` is still `database`. |
| The config resource APIs return `403`. | The release is not in `database` mode. The resource APIs require hybrid storage. |
| The UI navigation shows only **Get started** for LLM or MCP, and **Enable LLM** or **Enable MCP** reports that the file configuration is read-only. | The configuration has no `llm` or `mcp` section. The UI cannot add a section in `database` mode, because a section belongs to the read-only file. Add an empty section to your Helm values. |

-->

## Cleanup

{{< reuse "agw-docs/snippets/cleanup.md" >}}

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
