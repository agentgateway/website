## About

Agentgateway reads a configuration file at startup, and that file alone is enough for the proxy to route traffic. Some features need a database as well. The two hold different things. The configuration file describes how the proxy behaves. The database holds the data that these features accumulate while agentgateway runs, such as one record for each LLM request.

You set the database in the `config.database` field of your configuration file. Because the field is in the `config` section, agentgateway applies it at startup only, so a change to it takes effect after a restart.

```yaml
# yaml-language-server: $schema=https://agentgateway.dev/schema/config
config:
  database:
    url: sqlite://./data.db
gateways:
  default:
    port: 4000
ui:
  gateways: default
```

### Features that need a database

The proxy can route traffic with no database, so traffic use cases work by default. 

The following features do not work without a database. When you set up a database, the features also share that database.

| Feature | Description | What happens without a database |
| --- | --- | --- |
| LLM analytics and logs | The UI shows **Analytics** and **Logs** for LLM requests (not other proxy traffic such as HTTP routes to a backend service). The **Analytics** page is also the cost dashboard. To show spend in dollars instead of tokens and calls, add a [model cost catalog]({{< link-hextra path="/llm/cost-controls/costs/" >}}) as well as a database. For the controls on the page, see [Cost dashboard]({{< link-hextra path="/llm/cost-controls/dashboard/" >}}). | Agentgateway starts, but each UI page reports `request log database is not configured` and the admin API returns a `500` response. |
| [`hybrid` configuration storage]({{< link-hextra path="/setup/storage/" >}}) | When enabled, hybrid mode stores UI edit to agentgateway configuration in the database. | Agentgateway does not start: `config.storage.mode=hybrid requires config.database.url`. |
| [LLM API key budgets]({{< link-hextra path="/llm/cost-controls/budget-limits/" >}}) | API key budgets let you track LLM spend across restarts | Agentgateway does not start: `API key budgets require config.database to be configured`. |

### Logging database

Optionally, to keep request logs in a different database from the rest, you can set the `config.logging.database` field. Then, agentgateway writes request logs to the database in `config.logging.database`, and uses `config.database` for the other features.

> [!IMPORTANT]
> The `config.logging.database` field covers request logs only. It does not satisfy `hybrid` storage or API key budgets, because both features use the primary database. If you configure either feature with `config.logging.database` alone, agentgateway fails to start with the error in the preceding table.

### Choose a database backend

Agentgateway selects the backend from the URL. A URL that starts with `postgres://` or `postgresql://` is PostgreSQL. Every other value is a SQLite database file.

| Backend | Example URL | Use it when |
| --- | --- | --- |
| SQLite | `sqlite://./data.db` | You run a single agentgateway instance and want no external service. |
| PostgreSQL | `postgres://user:password@host:5432/dbname` | You run more than one replica, or you want the data to outlive the instance. |

SQLite writes to a file, so agentgateway needs a writable directory for it. PostgreSQL needs a reachable server and a user that can create tables.

> [!WARNING]
> Do not point more than one agentgateway instance at the same SQLite file. Give each instance its own file instead, or use PostgreSQL. With one file for each instance, the **Analytics** page shows the traffic of the instance that you are connected to, not the traffic of the whole deployment.

## Before you begin

[Install agentgateway]({{< link-hextra path="/setup/install/" >}}) as a binary, a Docker container, or a Kubernetes Deployment with Helm.

## Binary and Docker {#binary-docker}

In the binary and Docker installations, agentgateway writes the SQLite file to a directory that you control, so SQLite needs no extra service.

### Use the generated database {#generated}

When you start agentgateway with no configuration file, the generated configuration already sets a SQLite database, so no extra step is needed. The binary writes both files to your user config directory. A container writes both to the directory that you mount at the `/config` path.

1. Start agentgateway with no configuration file.

   {{< tabs >}}
   {{% tab name="Binary" %}}
   ```sh
   agentgateway
   ```
   {{% /tab %}}
   {{% tab name="Docker" %}}
   ```sh
   mkdir agentgateway-config
   docker run -d \
     --name agentgateway \
     --user "$(id -u):$(id -g)" \
     -v "$PWD/agentgateway-config:/config" \
     -p 4000:4000 \
     {{< reuse "agw-docs/standalone/image-ref.md" >}}:{{< reuse "agw-docs/versions/image-tag.md" >}}
   ```
   {{% /tab %}}
   {{< /tabs >}}

2. Review the generated configuration. The `config.database.url` field points at a SQLite file next to the configuration file. The following example is the file that a container generates. The binary generates the same file, with the absolute path of your user config directory in the URL.

   ```yaml
   # yaml-language-server: $schema=https://agentgateway.dev/schema/config
   config:
     database:
       url: sqlite:///config/data.db
   gateways:
     default:
       port: 4000
   ui:
     gateways: default
   ```

Because the generated configuration attaches the UI to the `default` gateway, the **Analytics** page is served on the gateway port, such as <http://localhost:4000/ui/llm/analytics>. The generated configuration has no `llm` section yet, so the **LLM** section of the navigation appears only after you add a model.

### Add a database to your own configuration file {#own-file}

A configuration file that you write yourself has no database until you add one. Add the `config.database` field, then restart agentgateway.

1. Add the `config.database.url` field to your configuration file.

   {{< tabs >}}
   {{% tab name="Binary" %}}
   The path is relative to the directory that you start agentgateway from.

   ```yaml
   # yaml-language-server: $schema=https://agentgateway.dev/schema/config
   config:
     database:
       url: sqlite://./data.db
   gateways:
     default:
       port: 4000
   ui:
     gateways: default
   llm:
     models:
     - name: gpt-4o-mini
       provider: openAI
       params:
         model: gpt-4o-mini
         apiKey: "$OPENAI_API_KEY"
   ```
   {{% /tab %}}
   {{% tab name="Docker" %}}
   Point the URL at a directory that you mount into the container. The example uses a `/data` path, because a mount of a single configuration file leaves no writable directory for the SQLite file.

   ```yaml
   # yaml-language-server: $schema=https://agentgateway.dev/schema/config
   config:
     database:
       url: sqlite:///data/data.db
   gateways:
     default:
       port: 4000
   ui:
     gateways: default
   llm:
     models:
     - name: gpt-4o-mini
       provider: openAI
       params:
         model: gpt-4o-mini
         apiKey: "$OPENAI_API_KEY"
   ```
   {{% /tab %}}
   {{< /tabs >}}

2. Restart agentgateway with the updated file.

   {{< tabs >}}
   {{% tab name="Binary" %}}
   Stop the current process, such as with `ctrl+c`, then start it again.

   ```sh
   agentgateway -f config.yaml
   ```
   {{% /tab %}}
   {{% tab name="Docker" %}}
   Mount the configuration file and a writable directory for the database.

   ```sh
   mkdir -p data
   docker rm -f agentgateway
   docker run -d \
     --name agentgateway \
     --user "$(id -u):$(id -g)" \
     -v "$PWD/config.yaml:/config.yaml" \
     -v "$PWD/data:/data" \
     -p 4000:4000 \
     {{< reuse "agw-docs/standalone/image-ref.md" >}}:{{< reuse "agw-docs/versions/image-tag.md" >}} \
     -f /config.yaml
   ```
   {{% /tab %}}
   {{< /tabs >}}

> [!IMPORTANT]
> If agentgateway cannot create the SQLite file, the process exits with `failed to initialize request log database`. In a container, this error usually means that the directory in the URL is not mounted, or that the mount is read-only. Point the URL at a directory that agentgateway can write to, and mount that directory into the container.

{{< doc-test paths="standalone-database" >}}
# WHAT THIS TEST VALIDATES:
#   * Without config.database, the admin API rejects an analytics query with a 500 -- the
#     "request log database is not configured" behavior that the About section describes.
#   * Adding config.database.url and restarting makes the same query succeed, which is the
#     "Add a database to your own configuration file" procedure for the binary.
#   * The binary accepts the documented sqlite:// URL form and creates the database file.
#   * The Logs page's API (/api/logs/search) follows the same rule as the Analytics API.
# WHAT THIS TEST DOES NOT VALIDATE (and why):
#   * The Docker tabs -- external dependency: standalone doc tests run the binary, not containers.
#   * The Helm sections -- external dependency: they need a cluster, the chart, and PostgreSQL.
#   * The generated-configuration section -- requires config the page omits: it starts
#     agentgateway with no -f, which writes into the user config directory.
#   * The Verify section's LLM request and the Analytics page contents -- external dependency:
#     an LLM provider key.
#   * The hybrid-storage and API key budget rows of the features table -- different layer:
#     those failures are startup errors covered by the Configuration storage and Budget limits pages.
{{< reuse "agw-docs/snippets/install-agentgateway-binary.md" >}}
# Baseline: a config file with no config.database section.
cat > config-nodb.yaml <<'NODB'
config:
  adminAddr: localhost:15000
gateways:
  default:
    port: 4000
ui:
  gateways: default
NODB
agentgateway -f config-nodb.yaml --validate-only
stop_gateway() {
  [ -n "${AGW_PID:-}" ] || return 0
  kill "$AGW_PID" 2>/dev/null || true
  wait "$AGW_PID" 2>/dev/null || true
  AGW_PID=""
}
trap stop_gateway EXIT
agentgateway -f config-nodb.yaml > agw-nodb.log 2>&1 &
AGW_PID=$!
sleep 4
{{< /doc-test >}}

{{< doc-test paths="standalone-database" >}}
YAMLTest -f - <<'NODBTEST'
- name: Analytics API rejects the query when no database is configured
  http:
    url: "http://localhost:15000"
    path: /api/logs/analytics/summary
    method: POST
    headers:
      content-type: application/json
    body: |
      {}
  source:
    type: local
  expect:
    statusCode: 500
  retries: 3
- name: Logs API rejects the query when no database is configured
  http:
    url: "http://localhost:15000"
    path: /api/logs/search
    method: POST
    headers:
      content-type: application/json
    body: |
      {}
  source:
    type: local
  expect:
    statusCode: 500
NODBTEST
{{< /doc-test >}}

{{< doc-test paths="standalone-database" >}}
# Add config.database.url, then restart, which is what the procedure tells the reader to do.
stop_gateway
cat > config-db.yaml <<'WITHDB'
config:
  adminAddr: localhost:15000
  database:
    url: sqlite://./data.db
gateways:
  default:
    port: 4000
ui:
  gateways: default
WITHDB
agentgateway -f config-db.yaml --validate-only
agentgateway -f config-db.yaml > agw-db.log 2>&1 &
AGW_PID=$!
sleep 4
if [ ! -f ./data.db ]; then
  echo "FAIL: agentgateway did not create the SQLite database file at ./data.db"
  exit 1
fi
{{< /doc-test >}}

{{< doc-test paths="standalone-database" >}}
YAMLTest -f - <<'WITHDBTEST'
- name: Analytics API answers the query when a database is configured
  http:
    url: "http://localhost:15000"
    path: /api/logs/analytics/summary
    method: POST
    headers:
      content-type: application/json
    body: |
      {}
  source:
    type: local
  expect:
    statusCode: 200
  retries: 3
- name: Logs API answers the query when a database is configured
  http:
    url: "http://localhost:15000"
    path: /api/logs/search
    method: POST
    headers:
      content-type: application/json
    body: |
      {}
  source:
    type: local
  expect:
    statusCode: 200
    bodyJsonPath:
    - path: "$.logs"
      comparator: exists
      value: ""
WITHDBTEST
{{< /doc-test >}}

## Helm {#helm}

The Helm chart renders your configuration into a ConfigMap and mounts it read-only, and the chart sets no database for you. As a result, a default installation starts with no database, and the **Analytics** and **Logs** pages report `request log database is not configured`.

To add a database, choose one of the following options.

| Option | Storage mode | Use it when |
| --- | --- | --- |
| [SQLite on a volume](#helm-sqlite) | The chart's default `readonly` mode | You want the **Analytics** and **Logs** pages, and you keep your Helm values as the only source of configuration. |
| [PostgreSQL in database mode](#helm-postgres) | The chart's `database` mode | You also want the admin UI to save configuration changes, or you run more than one replica. |

### Add SQLite on a volume {#helm-sqlite}

In the default `readonly` mode, the chart sets the storage mode and nothing else, so a `config.database` field in your Helm values reaches the rendered ConfigMap unchanged. SQLite needs a writable directory, and the proxy container runs with a read-only root filesystem, so mount a volume for the database file.

> [!NOTE]
> The chart's own `config` value says not to set `config.storage` or `config.database` yourself. That restriction applies to `database` mode, where the chart derives both fields from the `mode` and `database.postgres.url` values and overwrites what you set. In `readonly` mode, the chart sets `config.storage` only, so your `config.database` value is preserved.

1. Create a values file that sets the database URL and mounts a volume for it.

   ```yaml
   cat <<'EOF' > values.yaml
   mode: readonly
   config:
     config:
       database:
         url: sqlite:///data/data.db
     gateways:
       default:
         port: 4000
     llm:
       models: []
     mcp:
       targets: []
     ui: {}
   extraVolumes:
   - name: agw-data
     emptyDir: {}
   extraVolumeMounts:
   - name: agw-data
     mountPath: /data
   EOF
   ```

   {{< reuse "agw-docs/snippets/review-table.md" >}}

   | Setting | Description |
   | --- | --- |
   | `config.config.database.url` | The agentgateway `config.database.url` field. The outer `config` value is the whole configuration file, so the agentgateway `config` section is nested inside it. |
   | `extraVolumes` and `extraVolumeMounts` | A writable directory for the SQLite file. The proxy container mounts the ConfigMap read-only and runs with a read-only root filesystem, so no other path accepts a write. |

   > [!WARNING]
   > An `emptyDir` volume exists only for the lifetime of the pod. When the pod restarts, the request log data is lost. To keep the data, back the volume with a PersistentVolumeClaim, or use [PostgreSQL](#helm-postgres) instead.

2. Upgrade the release with your values file.

   {{< reuse "agw-docs/standalone/helm-upgrade-command.md" >}}

3. Confirm that the chart rendered the database into the ConfigMap.

   ```sh
   kubectl get configmap {{< reuse "agw-docs/standalone/helm-standalone-release.md" >}}-config \
     -n {{< reuse "agw-docs/snippets/namespace.md" >}} -o jsonpath='{.data.config\.yaml}'
   ```

   Example output:

   ```yaml
   config:
     database:
       url: sqlite:///data/data.db
     storage:
       mode: file
   gateways:
     default:
       port: 4000
   llm:
     models: []
   mcp:
     targets: []
   ui: {}
   ```

> [!NOTE]
> This option gives the **Analytics** and **Logs** pages a database, but it does not make the admin UI writable. The ConfigMap stays read-only, so a UI save still fails. To make the UI writable, see [Configuration storage]({{< link-hextra path="/setup/storage/" >}}).

### Add PostgreSQL in database mode {#helm-postgres}

The chart's `database` mode sets both `config.database.url` and `config.storage.mode: hybrid` for you. One PostgreSQL instance then serves the request log, the configuration overlay, and API key budgets.

1. Deploy PostgreSQL. For the example manifests, see [Deploy PostgreSQL]({{< link-hextra path="/setup/storage/#deploy-postgresql" >}}).

2. Create a values file that sets the mode and the connection URL.

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
       models: []
     mcp:
       targets: []
     ui: {}
   EOF
   ```

   > [!NOTE]
   > Do not set `config.config.database` in `database` mode. The chart derives the field from the `mode` and `database.postgres.url` values, and overwrites anything that you set for it yourself.

3. Upgrade the release with your values file.

   {{< reuse "agw-docs/standalone/helm-upgrade-command.md" >}}

4. Confirm that the tables exist. Agentgateway creates them on the first startup.

   ```sh
   kubectl exec -n {{< reuse "agw-docs/snippets/namespace.md" >}} deploy/postgres \
     -- psql -U agw -d agw -c '\dt'
   ```

   Example output: The `request_logs` and `request_log_payloads` tables hold the data for the **Analytics** page, `budget_usage` holds API key budgets, and `agw_config_resources` holds the configuration that you save in the UI.

   ```txt
                  List of relations
    Schema |         Name         | Type  | Owner
   --------+----------------------+-------+-------
    public | agw_config_resources | table | agw
    public | budget_usage         | table | agw
    public | request_log_payloads | table | agw
    public | request_logs         | table | agw
   (4 rows)
   ```

## Verify that agentgateway records requests {#verify}

Agentgateway records LLM requests only, so send a request to an LLM model to confirm that the database works. These steps need at least one model in the `llm` section of your configuration. For the steps to add one, see the [LLM quickstart]({{< link-hextra path="/quickstart/llm/" >}}).

1. Make the gateway port and the admin address reachable from your machine.

   {{< tabs >}}
   {{% tab name="Binary and Docker" %}}
   Both addresses are already local. The gateway listens on port 4000, and the admin address on port 15000.
   {{% /tab %}}
   {{% tab name="Port-forward for Helm" %}}
   ```sh
   kubectl port-forward -n {{< reuse "agw-docs/snippets/namespace.md" >}} \
     deploy/{{< reuse "agw-docs/standalone/helm-standalone-release.md" >}} 4000:4000 15000:15000
   ```
   {{% /tab %}}
   {{< /tabs >}}

2. Send a request to an LLM model through agentgateway.

   ```sh
   curl -s http://localhost:4000/v1/chat/completions \
     -H "Content-Type: application/json" \
     -d '{
       "model": "gpt-4o-mini",
       "messages": [{"role": "user", "content": "Say hello in one sentence."}]
     }' | jq .
   ```

3. Review the request log. The admin API is served in the same places as the UI, so use the admin address or the gateway port that serves the UI. For more information, see [Launch the UI]({{< link-hextra path="/setup/ui/launch-ui/" >}}).

   ```sh
   curl -s -X POST http://localhost:15000/api/logs/search \
     -H 'Content-Type: application/json' -d '{}' | jq .
   ```

   Example output: Agentgateway records the model, the token counts, and the duration for each request.

   ```json
   {
     "logs": [
       {
         "id": "01a03f23-f49e-7b31-90f8-0ba440d7c8fa",
         "startedAt": "2026-08-26T17:35:09.010434Z",
         "completedAt": "2026-08-26T17:35:16.123561Z",
         "durationMs": 7113,
         "httpStatus": 200,
         "genAi": {
           "operationName": "chat",
           "providerName": "openai",
           "requestModel": "gpt-4o-mini",
           "responseModel": "gpt-4o-mini-2024-07-18"
         },
         "usage": {"inputTokens": 14, "outputTokens": 5, "totalTokens": 19}
       }
     ],
     "nextCursor": null
   }
   ```

4. Open the **LLM** > **Analytics** page in the admin UI, such as <http://localhost:15000/ui/llm/analytics>. The request appears in the chart and in the breakdown. For more information about the controls on the page, see [Cost dashboard]({{< link-hextra path="/llm/cost-controls/dashboard/" >}}).

<!--TODO troubleshooting

## Troubleshooting

### The Analytics page reports that the database is not configured {#troubleshoot-not-configured}

**What is happening**

The **Analytics** page and the request log show an error, and the admin API returns a `500` response with the following message.

```txt
"request log database is not configured"
```

**Why it is happening**

The configuration that agentgateway loaded has no `config.database` field and no `config.logging.database` field. A Helm installation has neither by default. A configuration file that you write yourself has neither until you add one.

**How to fix it**

Add a database for your installation method, then restart agentgateway. See [Binary and Docker](#binary-docker) or [Helm](#helm). To confirm which configuration agentgateway loaded, review the effective configuration.

```sh
curl -s http://localhost:15000/api/config/effective | jq '.config.database'
```

### The Analytics page is empty after a request {#troubleshoot-empty}

**What is happening**

Agentgateway has a database, the admin API returns a `200` response, and the **Analytics** page still shows no data.

**Why it is happening**

Agentgateway records LLM requests only. A request that agentgateway proxies to an HTTP backend is not recorded, even when the request succeeds.

**How to fix it**

Send a request to a model that you configured in the `llm` section, then check the page again. For the steps, see [Verify that agentgateway records requests](#verify).

### Agentgateway does not start {#troubleshoot-startup}

**What is happening**

The process exits, and the logs report one of the following errors.

```txt
failed to initialize request log database	err=failed to connect sqlite database
```

```txt
Error: config.storage.mode=hybrid requires config.database.url
```

```txt
Error: API key budgets require config.database to be configured
```

**Why it is happening**

The first error means that agentgateway cannot create the SQLite file, most often because the directory in the URL does not exist or is not writable. The other two errors mean that a feature that requires `config.database` is configured without it.

**How to fix it**

For the SQLite error, point the URL at a directory that agentgateway can write to. In a container, mount that directory. In Helm, add the volume that [Add SQLite on a volume](#helm-sqlite) describes. For the other two errors, add the `config.database.url` field. Note that `config.logging.database` does not satisfy `hybrid` storage or API key budgets, because both features use the primary database.

To check a configuration file before you start agentgateway, validate it.

```sh
agentgateway --validate-only -f config.yaml
```

Example output:

```txt
Configuration is valid!
```

-->

## Next steps

* [Choose where configuration is stored]({{< link-hextra path="/setup/storage/" >}}) so that the admin UI can save your changes.
* [View LLM spend in the cost dashboard]({{< link-hextra path="/llm/cost-controls/dashboard/" >}}).
* [Set API key budgets]({{< link-hextra path="/llm/cost-controls/budget-limits/" >}}) that persist across restarts.
* [Review what agentgateway stores]({{< link-hextra path="/integrations/observability/database/" >}}) in each request log record.
