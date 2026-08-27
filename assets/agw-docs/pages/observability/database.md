Agentgateway records each LLM request that flows through the proxy into a database. This data powers the [cost dashboard]({{< link-hextra path="/llm/cost-controls/dashboard/" >}}) and the **Analytics** page in the UI. You configure the database backend in the `config.database.url` field. Agentgateway creates the schema on the first startup, so no migration step is required.{{< version include-if="main" >}} For the steps to set up the database in each installation method, see [Database]({{< link-hextra path="/setup/database/" >}}).{{< /version >}}

## Backends

Agentgateway supports two database backends, selected by the URL scheme.

| Database | URL scheme |
| --- | --- |
| SQLite (default) | `sqlite://` |
| PostgreSQL | `postgres://` or `postgresql://` |

## SQLite

SQLite is the default. It requires no external service and is suitable for a single agentgateway instance.

```yaml
config:
  database:
    url: "sqlite:///data/data.db"
```

The path after `sqlite://` is the filesystem path to the database file.

> [!WARNING]
> Do not point multiple agentgateway instances at the same SQLite file — use PostgreSQL instead.

## PostgreSQL

Set `config.database.url` to a `postgres://` or `postgresql://` connection string to use PostgreSQL.

```yaml
config:
  database:
    url: "postgres://user:password@host:5432/dbname"
```

The schema is created automatically on first startup, so it is safe to restart against an existing database.

## What is stored

Agentgateway writes one record for each LLM request. Other proxy traffic, such as an HTTP route to a backend service, is not recorded, even when the request succeeds. Each record captures:

- **Timing** — when the request started and completed, and total duration in milliseconds.
- **HTTP** — response status code and any error message.
- **LLM fields** — operation name, provider (e.g. `openai`, `anthropic`), the model name from the request and from the response, input/output/total token counts, and the realized USD cost (if a model cost catalog is configured).
- **Identity** — the user and group derived from the API key metadata or a JWT claim, and the client user agent.
- **Trace context** — OpenTelemetry trace ID and span ID, if tracing is enabled.
- **Full attribute blob** — all OpenTelemetry span attributes as JSON, including any fields that are also captured as dedicated fields above.

Optionally, agentgateway can also store the raw LLM prompt and completion JSON alongside each record. This is off by default and must be explicitly enabled.

## What is not stored in the database

In the default `file` storage mode, the database holds request log records only, and the configuration file (`config.yaml`) holds everything else.

| Item | Where it lives |
| --- | --- |
| Virtual / API keys | `config.yaml` under `llm.policies.apiKey.keys` |
| LLM provider credentials | `config.yaml` under `llm.models[].params.apiKey` (or environment variables) |
| Listeners, routes, backends | `config.yaml` (or UI, which writes back to `config.yaml`) |
| Model cost catalog | JSON file(s) referenced from `config.modelCatalog` |
| MCP server definitions | `config.yaml` |
| Rate limit and CORS policies | `config.yaml` |

{{< version include-if="main" >}}
> [!NOTE]
> The `hybrid` storage mode changes where some of these items live. In that mode, agentgateway also stores the resources that you manage in the UI in the same database, and layers them over the configuration file. For more information, see [Configuration storage]({{< link-hextra path="/setup/storage/" >}}).
{{< /version >}}

## Disable request logging

To run agentgateway without recording request logs, omit the `config.database` field entirely. The cost dashboard and analytics page will be unavailable, but all other functionality is unaffected.
