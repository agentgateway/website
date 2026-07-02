---
title: Cost dashboard
weight: 30
description: View LLM spend, tokens, and traffic in the built-in Admin UI, grouped by model, provider, and user.
test:
  cost-dashboard:
  - file: content/docs/standalone/main/llm/cost-controls/dashboard.md
    path: cost-dashboard
---

The [Model costs]({{< link-hextra path="/llm/cost-controls/costs/" >}}) guide prices every request and exposes the result to logs, metrics, and CEL. The built-in **Admin UI** turns that data into a visual dashboard: spend, tokens, and calls over time, broken down by model, provider, user, group, or user agent—no external Prometheus or Grafana required.

The dashboard is populated from a local database that agentgateway writes for every request that flows through the proxy. Because the accounting happens in the gateway, your applications need no changes: they point at the proxy, and spend shows up next to tokens automatically.

## Requirements

Two pieces of configuration power the dashboard:

- **`config.database`** — the SQLite database where agentgateway records a `request_logs` row for each request. This is the store behind the dashboard's time series and breakdowns.
- **`config.modelCatalog`** — the [model cost catalog]({{< link-hextra path="/llm/cost-controls/costs/" >}}) that turns token counts into dollars. Without a catalog, the dashboard still shows token and call volume, but cost is `0`.

## Enable the dashboard

1. Add `database` and `modelCatalog` to the `config` section of your config file. The `adminAddr` field controls where the Admin UI is served (default `localhost:15000`).

   ```yaml
   # yaml-language-server: $schema=https://agentgateway.dev/schema/config
   config:
     adminAddr: localhost:15000
     database:
       url: "sqlite:///data.db"
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

The dashboard is the **LLM > Analytics** page. Open [http://localhost:15000/ui/llm/analytics](http://localhost:15000/ui/llm/analytics). It shows traffic over time with a running tally of cost, tokens, and calls, plus a breakdown below the chart.

{{< reuse-image-light src="img/ui-cost-dashboard-tokens.png" alt="agentgateway Analytics dashboard showing token traffic over time, with group-by and measure controls" >}}
{{< reuse-image-dark srcDark="img/ui-cost-dashboard-tokens-dark.png" alt="agentgateway Analytics dashboard showing token traffic over time, with group-by and measure controls" >}}

{{< callout type="info" >}}
The separate **LLM > Costs** page ([http://localhost:15000/ui/llm/costs](http://localhost:15000/ui/llm/costs)) is where you *manage the cost catalog* (import or override pricing), not where you view spend. See [Model costs]({{< link-hextra path="/llm/cost-controls/costs/" >}}) for catalog setup.
{{< /callout >}}

### Group by and measure

Use the **Group by** control to break the same traffic down by:

- **Model** — which models drive spend (`gen_ai_request_model` / `gen_ai_response_model`).
- **Provider** — spend per backend, such as OpenAI, Anthropic, Google, or Bedrock (`gen_ai_provider_name`).
- **User** — per-person accounting, ideal for finding who drives spend (`agentgateway_user`).
- **Group** — spend per team or group (`agentgateway_group`).
- **User agent** — spend per client, such as Cursor, Claude Code, or `openai-python` (`user_agent_name`).

Toggle **Measure** between **Tokens**, **Cost**, and **Requests** to view the same breakdown either way. Set it to **Cost** to see realized spend in dollars:

{{< reuse-image-light src="img/ui-cost-dashboard-cost.png" alt="agentgateway Analytics dashboard measured in dollars, showing realized spend over time" >}}
{{< reuse-image-dark srcDark="img/ui-cost-dashboard-cost-dark.png" alt="agentgateway Analytics dashboard measured in dollars, showing realized spend over time" >}}

Use **Export** to pull the underlying numbers out for reporting.

## Send traffic and watch it get priced

With the gateway running, send a request that matches a model in your catalog:

```sh
curl -s http://localhost:4000/v1/chat/completions \
  -H "Content-Type: application/json" \
  -d '{"model":"gpt-4o-mini","messages":[{"role":"user","content":"Hello from agentgateway!"}]}'
```

Refresh the **Analytics** page and the request appears: tokens counted, cost calculated against the catalog, and attributed to the model, provider, and (if present) user. Each request is stored as a `request_logs` row with the realized `cost` alongside `input_tokens`, `output_tokens`, and `total_tokens`, which is why the same fields you see in [logs and metrics]({{< link-hextra path="/llm/observability/" >}}) also drive the dashboard.

## Persistence and scaling

The dashboard reads from the SQLite database at `config.database.url`. Point it at a persistent path so history survives restarts. For Helm-based deployments, the chart defaults to SQLite on a `ReadWriteOnce` volume; see [Helm deployment]({{< link-hextra path="/deployment/helm/" >}}) for storage options.

## What's next

- [Model costs]({{< link-hextra path="/llm/cost-controls/costs/" >}}) to configure the catalog that prices dashboard data
- [Observe traffic]({{< link-hextra path="/llm/observability/" >}}) to view the same cost fields in logs, metrics, and traces
- [Budget and spend limits]({{< link-hextra path="/llm/cost-controls/budget-limits/" >}}) to enforce caps once you can see spend
- [Admin UI]({{< link-hextra path="/operations/ui/" >}}) for the full Admin UI reference

{{< doc-test paths="cost-dashboard" >}}
# Install agentgateway binary
mkdir -p "$HOME/.local/bin"
export PATH="$HOME/.local/bin:$PATH"
VERSION="v{{< reuse "agw-docs/versions/n-patch.md" >}}"
BINARY_URL="https://github.com/agentgateway/agentgateway/releases/download/${VERSION}/agentgateway-$(uname -s | tr '[:upper:]' '[:lower:]')-$(uname -m | sed 's/x86_64/amd64/')"
curl -sL "$BINARY_URL" -o "$HOME/.local/bin/agentgateway"
chmod +x "$HOME/.local/bin/agentgateway"
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
