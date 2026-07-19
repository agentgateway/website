Agentgateway records every request that flows through the proxy into a database. This data powers the [cost dashboard]({{< link-hextra path="/llm/cost-controls/dashboard/" >}}) and the Analytics page in the Admin UI. You configure the database backend with a single `config.database.url` field, and the schema is created automatically on first startup — no migration step is required.

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

{{< callout type="warning" >}}
Do not point multiple agentgateway instances at the same SQLite file — use PostgreSQL instead.
{{< /callout >}}

## PostgreSQL

Set `config.database.url` to a `postgres://` or `postgresql://` connection string to use PostgreSQL.

```yaml
config:
  database:
    url: "postgres://user:password@host:5432/dbname"
```

The schema is created automatically on first startup, so it is safe to restart against an existing database.

## What is stored

Agentgateway writes one record per proxied request. Each record captures:

- **Timing** — when the request started and completed, and total duration in milliseconds.
- **HTTP** — response status code and any error message.
- **LLM fields** — operation name, provider (e.g. `openai`, `anthropic`), the model name from the request and from the response, input/output/total token counts, and the realized USD cost (if a model cost catalog is configured).
- **Identity** — the user and group derived from the API key metadata or a JWT claim, and the client user agent.
- **Trace context** — OpenTelemetry trace ID and span ID, if tracing is enabled.
- **Full attribute blob** — all OpenTelemetry span attributes as JSON, including any fields that are also captured as dedicated fields above.

Optionally, agentgateway can also store the raw LLM prompt and completion JSON alongside each record. This is off by default and must be explicitly enabled.

## What is not stored in the database

The database holds only request log records. Everything else in agentgateway is stored in the configuration file (`config.yaml`).

| Item | Where it lives |
| --- | --- |
| Virtual / API keys | `config.yaml` under `llm.policies.apiKey.keys` |
| LLM provider credentials | `config.yaml` under `llm.models[].params.apiKey` (or environment variables) |
| Listeners, routes, backends | `config.yaml` (or Admin UI, which writes back to `config.yaml`) |
| Model cost catalog | JSON file(s) referenced from `config.modelCatalog` |
| MCP server definitions | `config.yaml` |
| Rate limit and CORS policies | `config.yaml` |

## Disable request logging

To run agentgateway without recording request logs, omit the `config.database` field entirely. The cost dashboard and analytics page will be unavailable, but all other functionality is unaffected.
