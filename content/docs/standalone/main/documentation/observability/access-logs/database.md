---
title: Store logs in a database
weight: 30
description: Store agentgateway access logs in a SQLite or PostgreSQL database to power the UI analytics and enable historical log queries.
test: skip
aliases:
  - ../../../integrations/observability/database/
---

By default, access logs are written to stdout. To persist LLM request logs, configure agentgateway to write records to a `request_logs` table. The database logger captures LLM traffic, rather than every HTTP or MCP access log. Agentgateway can use the configuration database or a separate request-log database.

## Set up the database

Agentgateway supports **SQLite** and **PostgreSQL** as log storage backends. Set `config.logging.database.url` to the connection URL for your database. Agentgateway detects the backend from the URL. A `postgres://` or `postgresql://` URL uses PostgreSQL and any other value is treated as a SQLite file path. The UI has no field for `config.logging.database`, so set it in your configuration file.

```yaml
# yaml-language-server: $schema=https://agentgateway.dev/schema/config
config:
  logging:
    database:
      url: "sqlite:///data/logs.db"                        # SQLite
      # url: "postgres://user:password@host:5432/dbname"  # PostgreSQL
```

If you have a database configured for [configuration storage]({{< link-hextra path="/documentation/setup/storage/" >}}) in `config.database`, agentgateway automatically uses this database to store access logs. No additional configuration is required. Set `config.logging.database` explicitly when you want access logs to go to a different database than the one that is used for configuration storage. If neither `config.logging.database` nor `config.database` is set, no database log store is initialized and access logs are written to stdout only. 

For database setup instructions, including how to deploy PostgreSQL for Kubernetes installs, see [Configuration storage]({{< link-hextra path="/documentation/setup/storage/" >}}).

> [!IMPORTANT]
> The Helm chart renders the `config.database` and `config.storage` sections for you from its `mode` and `database.postgres.url` values, so do not set those two sections in your `values.yaml`. To send access logs to a separate database on a Helm install, set `config.logging.database` under the chart's top-level `config` field instead.
>
> ```yaml
> mode: database
> database:
>   postgres:
>     url: "postgres://user:password@host:5432/agentgateway"
> config:
>   logging:
>     database:
>       url: "postgres://user:password@host:5432/agentgateway_logs"
> ```

> [!NOTE]
> [Access log customizations]({{< link-hextra path="/documentation/observability/access-logs/view/#add-custom-fields-to-logs" >}}) interact with the database as follows:
> - **`filter`**: Access log filtering via the `frontendPolicies.accessLog.filter` field applies to stdout and the database. A request that is filtered out of stdout is also excluded from the database.
> - **`add`**: Adding custom log attributes via the `frontendPolicies.accessLog.add` field affects the access logs that are sent to stdout only. Use the `frontendPolicies.accessLog.database.add` field to add custom fields to database records.
> - **`remove`**: Access log attributes that are defined in `frontendPolicies.accessLog.remove` are only removed from stdout. The database schema is fixed, so this setting has no effect on what is stored in the database.

## Access log data storage

Each access log record captures the following data.

| Category | What is captured |
|----------|-----------------|
| **Timing** | Request start and end timestamps, duration in milliseconds |
| **HTTP** | Response status code, error message if any |
| **Generative AI** | Operation name, provider (for example `openai`), request model, response model, input/output/total token counts, and realized USD cost if a model cost catalog is configured |
| **Token details** | Input tokens read from and written to the prompt cache, and reasoning tokens. For more information, see [Token and latency columns](#token-latency-columns). |
| **Latency** | Time to first token and time per output token for streamed responses |
| **Identity** | User and group derived from API key metadata or a JWT claim, client user agent |
| **Trace context** | OpenTelemetry trace ID and span ID, if tracing is enabled |
| **Attributes** | All custom log attributes as a JSON blob |

### Token and latency columns {#token-latency-columns}

Besides the token totals, the `request_logs` table has the following columns for token details and latency. A token column is empty when the provider does not report the value. The latency columns are empty for responses that are not streamed.

| Column | Description | Log attribute |
|--------|-------------|---------------|
| `cache_read_input_tokens` | Input tokens that the provider read from its prompt cache. | `gen_ai.usage.cache_read.input_tokens` |
| `cache_creation_input_tokens` | Input tokens that the provider wrote to its prompt cache. | `gen_ai.usage.cache_creation.input_tokens` |
| `reasoning_tokens` | Output tokens that the model used for reasoning. | `gen_ai.usage.reasoning_tokens` |
| `time_to_first_token_ms` | Time to generate the first token of the response, in milliseconds. | `agw.ai.time_to_first_token` |
| `time_per_output_token_ms` | Average time to generate each output token, in milliseconds. | `agw.ai.time_per_output_token` |

The `agctl standalone analytics` command uses these columns to report the cache hit rate, the average time to first token, and the output tokens per second.

When a request prompt guard rejects an LLM request before the provider call, the database still stores a log record. The **Logs** page shows the rejection. The record includes request-side LLM metadata, but no provider response fields because the request never reaches the LLM provider.

By default, LLM prompt and completion content is not stored. To capture it, set `llm: full` under the `frontendPolicies.accessLog.database` section. You can set it in the UI or in your configuration file.

{{< tabs >}}
{{% tab name="UI" %}}
Whether the UI can save depends on your storage mode. For more information, see [Save changes from the UI]({{< link-hextra path="/documentation/setup/ui/launch-ui/#save-changes" >}}).

1. Open the **Settings** > **Observability** page, such as [http://localhost:15000/ui/settings/observability](http://localhost:15000/ui/settings/observability), and click the **Access logs** card.
2. In the **Database** section, select **Full** from the **LLM detail** dropdown.

   {{< reuse-image src="img/ui-access-logs-database-llm.png" srcDark="img/ui-access-logs-database-llm-dark.png" alt="Access logs drawer with the Database section, where the LLM detail dropdown is set to Full" >}}

3. Click **Save policy**.

You can also open the **Logs** page, such as [http://localhost:15000/ui/llm/logs](http://localhost:15000/ui/llm/logs), click **Settings**, select **Include prompts and completions in logs**, and click **Save settings**. Clearing that checkbox later sets `llm: metadata` instead of removing the field.
{{% /tab %}}
{{% tab name="Config file" %}}
```yaml
# yaml-language-server: $schema=https://agentgateway.dev/schema/config
frontendPolicies:
  accessLog:
    database:
      llm: full
```
{{% /tab %}}
{{< /tabs >}}

## Schema migrations {#schema-migrations}

At startup, agentgateway updates the request log schema in the database that stores request logs, which is `config.logging.database` or, if that field is not set, `config.database`. Agentgateway records each applied schema change in the `_agentgateway_request_log_migrations` table, so each change runs only once.

When you upgrade from an earlier version, such as 1.6, startup adds the [token and latency columns](#token-latency-columns) to the existing `request_logs` table. Then, it fills the new columns for existing LLM request rows from the `attributes_json` column, so analytics include requests that were logged before the upgrade. On a large table, this backfill can make the first startup after the upgrade take longer.

To check which schema changes are applied to a SQLite database, query the migrations table.

```sh
sqlite3 /path/to/logs.db \
  "SELECT version, description, success FROM _agentgateway_request_log_migrations;"
```

Example output:

```
1|create request log schema|1
2|add request log analytics columns|1
```

On PostgreSQL, the migrations table also lists version `3`, `backfill request log analytics columns`.

### Downgrade to an earlier version {#downgrade}

Before you upgrade, back up the database that stores request logs. After the upgrade migrates the database, downgrading behaves differently for each backend.

* **SQLite**: An earlier version starts and keeps writing request logs to the migrated database. It ignores the new columns, so the rows that it writes have no values in those columns. If you upgrade again, the migration does not run again, and those rows stay empty in the new columns.
* **PostgreSQL**: An earlier version fails to start, because the migrations table lists schema changes that it does not know. The error is similar to the following.

  ```
  Error: failed to migrate request log database schema
      migration 2 was previously applied but is missing in the resolved migrations
  ```

  To start the earlier version on the migrated database, delete the records of the newer schema changes. The new columns stay in the table, and the earlier version ignores them.

  ```sh
  psql "postgres://user:password@host:5432/dbname" \
    -c "DELETE FROM _agentgateway_request_log_migrations WHERE version IN (2, 3);"
  ```

  Example output:

  ```
  DELETE 2
  ```

  When you upgrade again, the migrations run again and fill the new columns for the rows that the earlier version wrote.

## Query the database

Use [agctl]({{< link-hextra path="/documentation/operations/agctl/" >}}) for routine queries through the gateway API. You do not need database credentials on the machine running the CLI.

```sh
agctl standalone logs --limit 10
agctl standalone logs --since 1h --attributes -o json
agctl standalone analytics --by provider,model --since 24h
```

To inspect a stored prompt and completion, run `agctl standalone logs <request-id>` with an ID from the listing. Payloads are available only when capture was enabled. For filters and streaming, see [View LLM request logs with agctl]({{< link-hextra path="/documentation/observability/access-logs/view/#cli" >}}).

### Query with a database client

Use your database client to inspect the `request_logs` table directly and verify that access logs were written successfully. The following examples show the most recent 10 log entries.

{{< tabs >}}
{{% tab name="SQLite" %}}

```sh
sqlite3 /path/to/logs.db \
  "SELECT id, started_at, http_status, gen_ai_provider_name, duration_ms FROM request_logs ORDER BY started_at DESC LIMIT 10;"
```

{{% /tab %}}
{{% tab name="PostgreSQL" %}}

```sh
psql "postgres://user:password@host:5432/dbname" \
  -c "SELECT id, started_at, http_status, gen_ai_provider_name, duration_ms FROM request_logs ORDER BY started_at DESC LIMIT 10;"
```

{{% /tab %}}
{{< /tabs >}}

To include LLM prompt and completion content (if you enabled `llm: full`), join the `request_log_payloads` table.

```sql
SELECT r.id, r.started_at, r.http_status, p.request_prompt_json, p.response_completion_json
FROM request_logs r
LEFT JOIN request_log_payloads p ON r.id = p.log_id
ORDER BY r.started_at DESC
LIMIT 10;
```

## Add custom fields to database logs

Use the `frontendPolicies.accessLog.database.add` field to store additional access log fields that are evaluated as CEL expressions alongside each record.

{{< tabs >}}
{{% tab name="UI" %}}
1. Open the **Settings** > **Observability** page, and click the **Access logs** card.
2. In the **Database** section, under **Database fields**, enter `user_id` as the name and `request.headers["x-user-id"]` as the value, and click **Add**.

   {{< reuse-image src="img/ui-access-logs-database-fields.png" srcDark="img/ui-access-logs-database-fields-dark.png" alt="Access logs drawer with the Database section, where the database fields list has a user_id field set to the x-user-id request header" >}}

3. Click **Save policy**.
{{% /tab %}}
{{% tab name="Config file" %}}
```yaml
# yaml-language-server: $schema=https://agentgateway.dev/schema/config
frontendPolicies:
  accessLog:
    database:
      add:
        user_id: 'request.headers["x-user-id"]'
```
{{% /tab %}}
{{< /tabs >}}

Custom fields are stored as a JSON blob in the `attributes_json` column of the `request_logs` table, not as separate columns. After sending another LLM request, inspect the new fields through the CLI, or use your database's JSON functions below.

```sh
agctl standalone logs --attributes -o json
agctl standalone analytics --by user_id --since 1h
```

{{< tabs >}}
{{% tab name="SQLite" %}}

```sh
sqlite3 /path/to/logs.db \
  "SELECT id, json_extract(attributes_json, '$.user_id') AS user_id, started_at, http_status
FROM request_logs
ORDER BY started_at DESC
LIMIT 10;"
```

{{% /tab %}}
{{% tab name="PostgreSQL" %}}

```sh
psql "postgres://user:password@host:5432/dbname" \
  -c "SELECT id, attributes_json->>'user_id' AS user_id, started_at, http_status FROM request_logs ORDER BY started_at DESC LIMIT 10;"
```

{{% /tab %}}
{{< /tabs >}}

## Disable database logging

Agentgateway writes request logs to `config.logging.database`. If that field is not set, agentgateway writes request logs to `config.database` instead. To stop writing access logs to a database, remove both fields, and then restart agentgateway. If you keep `config.database` for other features, such as budgets or hybrid configuration storage, agentgateway keeps writing request logs to that database. After you remove both fields, access logs continue to go to stdout, and the database-backed UI pages and the `agctl standalone logs` and `agctl standalone analytics` commands become unavailable.
