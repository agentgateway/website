---
title: Cost dashboard
weight: 30
description: View LLM spend, tokens, and traffic in the built-in UI, grouped by model, provider, and user.
test:
  cost-dashboard:
  - file: ${versionRoot}/documentation/llm/cost-controls/dashboard.md
    path: cost-dashboard
---

The [Model costs]({{< link-hextra path="/documentation/llm/cost-controls/costs/" >}}) guide prices every request and exposes the result to logs, metrics, and CEL. The built-in **UI** turns that data into a visual dashboard: spend, tokens, and calls over time, broken down by model, provider, user, group, or user agent. No external Prometheus or Grafana is required.

The dashboard is populated from a local database that agentgateway writes for every request that flows through the proxy. Because the accounting happens in the gateway, your applications need no changes. They point at the proxy, and spend shows up next to tokens automatically.

## Requirements

Two pieces of configuration power the dashboard:

- `config.database`: the database where agentgateway records an entry for each request. It is the store behind the dashboard's time series and breakdowns.
- `config.modelCatalog`: the [model cost catalog]({{< link-hextra path="/documentation/llm/cost-controls/costs/" >}}) that turns token counts into dollars. The built-in catalog prices common public models without any configuration, so set this field to price other models or to override rates. Requests to models that no catalog prices still count toward token and call volume, but add no cost.

## Enable the dashboard

1. Add `database` and `modelCatalog` to the `config` section of your config file. The `adminAddr` field controls where the UI is served (default `localhost:15000`).

   ```yaml
   # yaml-language-server: $schema=https://agentgateway.dev/schema/config
   config:
     adminAddr: localhost:15000
     database:
       url: "sqlite://./data.db?mode=rwc"
     modelCatalog:
     - file: ./costs/catalog.json
   llm:
     port: 4000
     models:
     - name: "*"
       provider: openAI
       params:
         apiKey: "$OPENAI_API_KEY"
   ```

2. Start agentgateway.

   ```sh
   agentgateway -f config.yaml
   ```

   Example output:

   ```
   INFO app  serving UI at http://localhost:15000/ui
   ```

## Open the dashboard

Review the dashboard in the **LLM > Analytics** page. Open [http://localhost:15000/ui/llm/analytics](http://localhost:15000/ui/llm/analytics). It shows traffic over time with a running tally of cost, tokens, and calls, plus a breakdown below the chart.

{{< reuse-image-light src="img/ui-cost-dashboard-tokens.png" alt="agentgateway Analytics dashboard showing token traffic over time, with group-by and measure controls" >}}
{{< reuse-image-dark srcDark="img/ui-cost-dashboard-tokens-dark.png" alt="agentgateway Analytics dashboard showing token traffic over time, with group-by and measure controls" >}}

> [!NOTE]
> The separate **LLM > Costs** page ([http://localhost:15000/ui/llm/costs](http://localhost:15000/ui/llm/costs)) is where you *manage the cost catalog* (import or override pricing), not where you view spend. See [Model costs]({{< link-hextra path="/documentation/llm/cost-controls/costs/" >}}) for catalog setup.

### Group by and measure

Use the **Group by** control to break the same traffic down by:

- **Model**: which models drive spend (`gen_ai_request_model` / `gen_ai_response_model`).
- **Provider**: spend per backend, such as OpenAI, Anthropic, Google, or Bedrock (`gen_ai_provider_name`).
- **User**: per-person accounting, ideal for finding who drives spend (`agentgateway_user`).
- **Group**: spend per team or group (`agentgateway_group`).
- **User agent**: spend per client, such as Cursor, Claude Code, or `openai-python` (`user_agent_name`).

Toggle **Measure** between tokens, cost, and requests to view the same breakdown either way. Set it to **Cost** to see realized spend in dollars.

{{< reuse-image-light src="img/ui-cost-dashboard-cost.png" alt="agentgateway Analytics dashboard measured in dollars, showing realized spend over time" >}}
{{< reuse-image-dark srcDark="img/ui-cost-dashboard-cost-dark.png" alt="agentgateway Analytics dashboard measured in dollars, showing realized spend over time" >}}

Use **Export** to pull the underlying numbers out for reporting.

To narrow the dashboard to certain models, users, groups, providers, or user agents, use the filter dropdowns. Each filter lists the values from recorded traffic. To find a value in a long list, type part of it in the search box at the top of the filter, and then select the value. Typing alone does not change the dashboard.

## Send traffic and watch it get priced

With the gateway running, send a request that matches a model in your catalog:

```sh
curl -s http://localhost:4000/v1/chat/completions \
  -H "Content-Type: application/json" \
  -d '{"model":"gpt-4o-mini","messages":[{"role":"user","content":"Hello from agentgateway!"}]}'
```

Refresh the **Analytics** page and the request appears: tokens counted, cost calculated against the catalog, and attributed to the model, provider, and (if present) user. The realized `cost` is recorded alongside token counts, which is why the same fields you see in [logs and metrics]({{< link-hextra path="/documentation/llm/observability/" >}}) also drive the dashboard.

## Query analytics with agctl {#cli}

Use `agctl standalone analytics` to query the same request-log database as the dashboard. Before you run these commands, [install agctl and connect it to your gateway]({{< link-hextra path="/documentation/operations/config-resources/#connect" >}}). The database must contain LLM requests. A configured model without traffic has no analytics to report.

1. Summarize the past 24 hours. The table reports requests, errors, tokens, realized cost, average time to first token (TTFT), generated tokens per second, and the share of input tokens that the provider read from its prompt cache.

   ```sh
   agctl standalone analytics
   ```

   Example output:

   ```text
   REQUESTS  ERRORS  TOKENS  COST       AVG TTFT  TOK/S  CACHE HIT
   5         0       905     $0.004775  -         -      0.0%
   ```

   The TTFT and tokens-per-second columns are empty for requests that do not stream the response.

2. Group the results by provider and requested model. The `--since` flag takes durations such as `30m` and `24h`, not days. For seven days, use `168h`.

   ```sh
   agctl standalone analytics --by provider,model --since 168h
   ```

   Example output:

   ```text
   PROVIDER  MODEL        REQUESTS  ERRORS  TOKENS  COST       AVG TTFT  TOK/S  CACHE HIT
   openai    gpt-4o       2         0       452     $0.004505  -         -      0.0%
   openai    gpt-4o-mini  3         0       453     $0.000270  -         -      0.0%
   TOTAL                  5         0       905     $0.004775  -         -      0.0%
   ```

3. Compare the spending of users or groups. These groupings use the stored attributes, including the standard identity mappings of the gateway.

   ```sh
   agctl standalone analytics --by agentgateway.user --since 24h
   agctl standalone analytics --by agentgateway.group --since 24h
   ```

   Example output of the first command:

   ```text
   AGENTGATEWAY.USER  REQUESTS  ERRORS  TOKENS  COST       AVG TTFT  TOK/S  CACHE HIT
   alice              3         0       673     $0.003225  -         -      0.0%
   bob                2         0       232     $0.001551  -         -      0.0%
   TOTAL              5         0       905     $0.004775  -         -      0.0%
   ```

4. Split the results into hourly buckets, and filter by provider.

   ```sh
   agctl standalone analytics --by model --provider openai --since 6h --interval 1h
   ```

   Example output:

   ```text
   TIME              MODEL        REQUESTS  ERRORS  TOKENS  COST       AVG TTFT  TOK/S  CACHE HIT
   2026-10-20 14:58  gpt-4o       2         0       452     $0.004505  -         -      0.0%
   2026-10-20 14:58  gpt-4o-mini  3         0       453     $0.000270  -         -      0.0%
   TOTAL                          5         0       905     $0.004775  -         -      0.0%
   ```

5. Export the summary as JSON for further processing.

   ```sh
   agctl standalone analytics --by provider,model --since 24h -o json > analytics.json
   ```

To group by the model in the provider response, use `--by response-model`. For TTFT histogram buckets per requested model, use `--by model,ttft`. You can also group by a custom attribute, such as `--by team`, when you [store that attribute in the database logs]({{< link-hextra path="/documentation/observability/access-logs/database/#add-custom-fields-to-database-logs" >}}).

Analytics describes recorded traffic. It does not show budget enforcement or the invoice of a provider. Requests that a log filter excludes do not count, and requests without a price add no cost. For the budget usage of each key, use [`agctl standalone budgets`]({{< link-hextra path="/documentation/llm/cost-controls/budget-limits/per-key/#step-6-check-budget-usage" >}}). For all filters and formats, see the [`analytics` reference]({{< link-hextra path="/reference/agctl/agctl-standalone-analytics/" >}}).

## Persistence and scaling

The dashboard reads from the database at `config.database.url`. Agentgateway supports SQLite (default, single instance) and PostgreSQL. See [Request Log]({{< link-hextra path="/documentation/observability/access-logs/database/" >}}) for full configuration details, including connection string format, credentials, and schema reference.

{{< doc-test paths="cost-dashboard" >}}
{{< reuse "agw-docs/snippets/install-agentgateway-binary.md" >}}
export OPENAI_API_KEY="${OPENAI_API_KEY:-test}"

# A catalog so modelCatalog loads and validates.
mkdir -p costs
cat > costs/catalog.json <<'JSON'
{ "providers": { "openai": { "models": {
  "gpt-4o-mini": { "rates": { "input": "0.15", "output": "0.6", "cacheRead": "0.075" } }
} } } }
JSON

# Config with database + modelCatalog (mode=rwc so SQLite creates the file).
cat > config.yaml <<'EOF'
# yaml-language-server: $schema=https://agentgateway.dev/schema/config
config:
  adminAddr: localhost:15000
  database:
    url: "sqlite://./data.db?mode=rwc"
  modelCatalog:
  - file: ./costs/catalog.json
llm:
  port: 4000
  models:
  - name: "*"
    provider: openAI
    params:
      apiKey: "$OPENAI_API_KEY"
EOF
agentgateway -f config.yaml --validate-only

agentgateway -f config.yaml &
AGW_PID=$!
trap 'kill $AGW_PID 2>/dev/null' EXIT
sleep 4
{{< /doc-test >}}

{{< doc-test paths="cost-dashboard" >}}
YAMLTest -f - <<'EOF'
- name: Costs dashboard page serves
  http:
    url: "http://localhost:15000/ui/llm/costs"
    method: GET
  source:
    type: local
  expect:
    statusCode: 200
  retries: 3
- name: Analytics dashboard page serves
  http:
    url: "http://localhost:15000/ui/llm/analytics"
    method: GET
  source:
    type: local
  expect:
    statusCode: 200
  retries: 3
EOF
{{< /doc-test >}}
