---
title: Store logs in a database
weight: 30
description: Store agentgateway access logs in a SQLite or PostgreSQL database to power the UI analytics and enable historical log queries.
test: skip
aliases:
  - /docs/standalone/latest/integrations/observability/database/
---

By default, all access logs are written to stdout. To persist access logs, you can configure agentgateway to write logs to a `request_logs` table in your database. Agentgateway can write logs to the same database that you use for configuration storage, or you can also choose to send access logs to a separate database to keep them separate. 

## Set up the database

Agentgateway supports **SQLite** and **PostgreSQL** as log storage backends. Set `config.logging.database.url` to the connection URL for your database. Agentgateway detects the backend from the URL. A `postgres://` or `postgresql://` URL uses PostgreSQL and any other value is treated as a SQLite file path.

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
| **Identity** | User and group derived from API key metadata or a JWT claim, client user agent |
| **Trace context** | OpenTelemetry trace ID and span ID, if tracing is enabled |
| **Attributes** | All custom log attributes as a JSON blob |

By default, LLM prompt and completion content is not stored. To capture it, set `llm: full` under the `frontendPolicies.accessLog.database` section.

```yaml
# yaml-language-server: $schema=https://agentgateway.dev/schema/config
frontendPolicies:
  accessLog:
    database:
      llm: full
```

## Query the database

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

```yaml
# yaml-language-server: $schema=https://agentgateway.dev/schema/config
frontendPolicies:
  accessLog:
    database:
      add:
        user_id: 'request.headers["x-user-id"]'
```

Custom fields are stored as a JSON blob in the `attributes_json` column of the `request_logs` table, not as separate columns. Use your database's JSON functions to extract them.

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

To stop writing access logs to a database, remove both `config.logging.database` and `config.database` from your configuration. Access logs continue to go to stdout. The cost dashboard and analytics pages in the UI become unavailable, but all other functionality is unaffected.
