---
title: Per-key dollar or token budgets
weight: 10
description: Cap what one API key spends on LLM traffic in US dollars or in tokens, and limit which models it can reach.
test:
  apikey-budgets:
  - file: ${versionRoot}/llm/cost-controls/budget-limits/per-key.md
    path: apikey-budgets
---

Cap what one API key spends on LLM traffic, in US dollars or in tokens.

## About per-key budgets

A per-key budget is a `budgets` entry on an API key. It charges the realized cost or the token usage of each request that the key sends, and it rejects or records requests once the key passes its limit.

A `USD` budget is a true spend cap, which is the main reason to choose a per-key budget over a [rate limit token budget]({{< link-hextra path="/documentation/llm/cost-controls/budget-limits/rate-limit/" >}}). Agentgateway prices each request from a [model cost catalog]({{< link-hextra path="/documentation/llm/cost-controls/costs/" >}}) and charges the result, so the cap holds however the model mix changes.

A `Tokens` budget caps token usage instead, and needs no catalog.

For the charging model and the window alignment, see [Budget and spend limits]({{< link-hextra path="/documentation/llm/cost-controls/budget-limits/" >}}).

## Before you begin

{{< reuse "agw-docs/snippets/prereq-agentgateway.md" >}}

{{< doc-test paths="apikey-budgets" >}}
# ============================================================================
# Doc test coverage for this guide (these comments are not rendered on the page)
# ============================================================================
# WHAT THIS TEST VALIDATES:
#   * "Step 2": the documented per-key budget config is accepted by
#     agentgateway (--validate-only), so config.database, config.modelCatalog,
#     budgets, and allowedModels are all spelled correctly.
#   * "Step 4": allowedModels rejects a model outside the allowed patterns
#     with a 403 and the model_not_allowed code, and the rejected request is
#     not charged.
#   * "Step 5": a USD Block budget rejects with 429 and the budget_exceeded
#     code once the key's realized cost passes the limit.
#   * "Step 6": the admin API reports a USD figure above the limit, which is
#     the overshoot the guide describes - the request that crossed the limit
#     completed and was charged.
#   * "Step 7": a Tokens Audit budget reports itself as exceeded and still
#     returns 200.
#
# WHAT THIS TEST DOES NOT VALIDATE (and why):
#   * Budget state surviving a restart. That needs a second gateway start
#     against the same database, which the generated script has no clean way
#     to sequence around the trap that stops the first one.
#
# COST AND TOKEN ARITHMETIC (why the assertions below are shaped the way they are):
#   The mock LLM reports the request's max_tokens value as completion_tokens
#   and 1 as prompt_tokens. With the catalog rates this guide writes in Step 1
#   ($10 per 1M input, $30 per 1M output), every request costs exactly
#   1/1e6*10 + 100/1e6*30 = $0.00301 and uses exactly 101 tokens. Step 4 spends
#   one request, so the second request of the Step 5 loop crosses the $0.008
#   limit and the run ends at $0.00903.
#   A hidden assertion that repeated a visible request would charge the key
#   twice and desynchronize the figures the page prints. So each hidden block
#   asserts only what is stable once the preceding visible block has run: a
#   rejected request charges nothing, and an exceeded budget stays exceeded.
{{< reuse "agw-docs/snippets/install-agentgateway-binary.md" >}}
{{< reuse "agw-docs/snippets/start-mock-llm.md" >}}
{{< /doc-test >}}

## Set a dollar budget

### Step 1: Load a model cost catalog

A `USD` budget charges the realized cost of each request, and agentgateway computes that cost from a model cost catalog. Create a catalog that prices the model you route to. Rates are the price per 1M tokens, written as strings. The following example charges $10 per 1M input tokens and $30 per 1M output tokens.

> [!TIP]
> To generate a catalog for real provider pricing instead of writing one by hand, use [`agctl catalog import`]({{< link-hextra path="/reference/agctl/agctl-catalog-import/" >}}). For the full catalog format and how to layer overrides, see [Model costs]({{< link-hextra path="/documentation/llm/cost-controls/costs/" >}}).

```sh {paths="apikey-budgets"}
cat <<'EOF' > catalog.json
{
  "providers": {
    "openai": {
      "models": {
        "gpt-5": { "rates": { "input": "10.0", "output": "30.0" } }
      }
    }
  }
}
EOF
```

### Step 2: Configure budgets on your API keys

Create a configuration with a database, the catalog, API key authentication, and a budget on each key.

```yaml {paths="apikey-budgets"}
cat <<'EOF' > config.yaml
# yaml-language-server: $schema=https://agentgateway.dev/schema/config

config:
  database:
    url: sqlite://budgets.db
  modelCatalog:
  - file: ./catalog.json
llm:
  policies:
    apiKey:
      mode: strict
      keys:
      - key: sk-team-a-abc123def456
        metadata:
          name: team-a
        allowedModels:
        - "gpt-5*"
        budgets:
        - name: daily-spend
          limit:
            unit: USD
            amount: 0.008
          window:
            rolling: 24h
          onBudgetExceeded: Block
      - key: sk-team-b-xyz789uvw012
        metadata:
          name: team-b
        budgets:
        - name: daily-tokens
          limit:
            unit: Tokens
            amount: 250
          window:
            rolling: 24h
          onBudgetExceeded: Audit
  models:
  - name: "*"
    provider: openAI
    params:
      apiKey: "$OPENAI_API_KEY"
EOF
```

The `team-a` key has a dollar budget that blocks requests when the budget is exhausted, and the `team-b` key has a token budget that only records the overage. Review the following table to understand this configuration. Both limits are small so that you can reach them in a few requests. Use realistic limits in production.

| Setting | Description |
| -- | -- |
| `config.database.url` | Connection string for the database that holds budget counts. Agentgateway supports SQLite and PostgreSQL. A budget requires this exact field, and agentgateway refuses to start without it. Setting `config.logging.database.url` instead does not satisfy the requirement, because that field configures request logging only. For the other things that the database stores, see [Configuration storage]({{< link-hextra path="/documentation/setup/storage/" >}}). |
| `config.modelCatalog` | Catalog sources that price each request. A `USD` budget requires a catalog entry for every model that the key uses. A `Tokens` budget does not. |
| `metadata.name` | Identifies the key in budget counts, logs, and the admin API. A key that has a budget requires this field. |
| `budgets` | List of budgets that are charged independently. A key can have several budgets, such as an hourly dollar cap and a monthly dollar cap. |
| `budgets[].name` | Names the budget within its key. The name must be unique among that key's budgets. |
| `budgets[].limit.unit` | `USD` to cap realized cost, or `Tokens` to cap token usage. |
| `budgets[].limit.amount` | The maximum usage in the window. A `Tokens` amount must be a whole number. A `USD` amount takes up to nine decimal places. |
| `budgets[].window.rolling` | Length of the fixed usage window, such as `1h`, `24h`, or `30d`. Windows are aligned to the Unix epoch rather than to the key's first request. |
| `budgets[].onBudgetExceeded` | `Block` to reject requests with a `429` after the limit is passed, or `Audit` to record the overage and allow the request. |
| `allowedModels` | Model name patterns that the key can reach. Omit the field to leave the key unconstrained. For more information, see [Limit model access per key](#limit-model-access-per-key). |

> [!WARNING]
> A `USD` budget charges nothing unless the catalog prices the models that the key uses. Agentgateway does not report an error in this case. The budget stays at zero usage and never rejects a request. Before you rely on a `USD` budget, confirm that the access log records `agw.ai.usage.cost.total` for the traffic that the budget covers.

### Step 3: Start agentgateway

```sh
agentgateway -f config.yaml
```

{{< doc-test paths="apikey-budgets" >}}
# Per-key budgets: validate the documented config, then run it against the mock LLM.
{{< reuse "agw-docs/snippets/point-config-at-mock-llm.md" >}}
agentgateway -f config-mock.yaml &
AGW_PID=$!
trap 'kill $AGW_PID $MOCK_LLM_PID 2>/dev/null' EXIT
sleep 3
{{< /doc-test >}}

### Step 4: Verify model access

1. Send a request for a model that the key is allowed to use. Verify that the request succeeds. At the catalog rates from Step 1, this request costs about $0.003 of the key's $0.008 budget.

   ```sh {paths="apikey-budgets"}
   curl -s -o /dev/null -w "%{http_code}\n" http://localhost:4000/v1/chat/completions \
     -H "Authorization: Bearer sk-team-a-abc123def456" \
     -H "Content-Type: application/json" \
     -d '{
       "model": "gpt-5",
       "max_tokens": 100,
       "messages": [{"role": "user", "content": "Hello!"}]
     }'
   ```

   Example output:

   ```
   200
   ```

2. Send a request for a model that the key is not allowed to use. Verify that agentgateway rejects the request with a `403` status.

   ```sh {paths="apikey-budgets"}
   curl -s http://localhost:4000/v1/chat/completions \
     -H "Authorization: Bearer sk-team-a-abc123def456" \
     -H "Content-Type: application/json" \
     -d '{
       "model": "claude-sonnet-5",
       "max_tokens": 100,
       "messages": [{"role": "user", "content": "Hello!"}]
     }'
   ```

   Example output:

   ```json
   {"error":{"message":"Model is not allowed for this API key","type":"invalid_request_error","code":"model_not_allowed"}}
   ```

   A rejected request never reaches a provider, so agentgateway does not charge it to the key's budget.

{{< doc-test paths="apikey-budgets" >}}
# A rejected model request charges nothing, so repeating it here does not move
# the count that the following steps depend on.
sleep 2
YAMLTest -f - <<'EOF'
- name: a model outside allowedModels is rejected
  http:
    url: "http://localhost:4000"
    path: /v1/chat/completions
    method: POST
    headers:
      content-type: application/json
      Authorization: "Bearer sk-team-a-abc123def456"
    body: |
      {
        "model": "claude-sonnet-5",
        "max_tokens": 100,
        "messages": [{"role": "user", "content": "Hello!"}]
      }
  source:
    type: local
  expect:
    statusCode: 403
    bodyJsonPath:
      - path: "$.error.code"
        comparator: equals
        value: model_not_allowed

- name: the rejected request did not charge the budget
  http:
    url: "http://localhost:15000"
    path: "/api/budgets/status?apiKeyName=team-a"
    method: GET
  source:
    type: local
  expect:
    statusCode: 200
    bodyJsonPath:
      # Step 4 sent one successful request, which cost $0.00301. The rejected
      # model request cost nothing, so the charge is still $0.00301.
      - path: "$.budgets[?(@.name=='daily-spend')].usage.used"
        comparator: equals
        value: "0.00301"
EOF
{{< /doc-test >}}

### Step 5: Verify the dollar budget

1. Send three more requests with the `team-a` key. Each request costs about $0.003, and Step 4 already spent $0.003. The second request in this loop therefore takes the key past its $0.008 limit.

   ```sh {paths="apikey-budgets"}
   for i in 1 2 3; do
     curl -s -o /dev/null -w "request $i: %{http_code}\n" http://localhost:4000/v1/chat/completions \
       -H "Authorization: Bearer sk-team-a-abc123def456" \
       -H "Content-Type: application/json" \
       -d '{
         "model": "gpt-5",
         "max_tokens": 100,
         "messages": [{"role": "user", "content": "Hello!"}]
       }'
   done
   ```

   The second request completes and takes the total to $0.00903, so the third request is the first one that agentgateway rejects.

   Example output:

   ```
   request 1: 200
   request 2: 200
   request 3: 429
   ```

2. Send one more request to see the error body.

   ```sh {paths="apikey-budgets"}
   curl -s http://localhost:4000/v1/chat/completions \
     -H "Authorization: Bearer sk-team-a-abc123def456" \
     -H "Content-Type: application/json" \
     -d '{
       "model": "gpt-5",
       "max_tokens": 100,
       "messages": [{"role": "user", "content": "Hello!"}]
     }'
   ```

   Example output:

   ```json
   {"error":{"message":"Budget exceeded","type":"rate_limit_error","code":"budget_exceeded"}}
   ```

   Agentgateway also writes a log line for each rejected request. A `USD` budget reports its amounts in dollars.

   ```
   warn budget API key budget exceeded api_key="team-a" budget="daily-spend" used=0.00903 limit_unit="USD" limit_amount=0.008 exceeded=true
   ```

{{< doc-test paths="apikey-budgets" >}}
# A rejected request charges nothing, so the charge stays at $0.00903 and this
# block can assert both the rejection and the resulting state.
sleep 2
YAMLTest -f - <<'EOF'
- name: a request past the limit is rejected with budget_exceeded
  http:
    url: "http://localhost:4000"
    path: /v1/chat/completions
    method: POST
    headers:
      content-type: application/json
      Authorization: "Bearer sk-team-a-abc123def456"
    body: |
      {
        "model": "gpt-5",
        "max_tokens": 100,
        "messages": [{"role": "user", "content": "Hello!"}]
      }
  source:
    type: local
  expect:
    statusCode: 429
    bodyJsonPath:
      - path: "$.error.code"
        comparator: equals
        value: budget_exceeded

- name: the request that crossed the limit completed and was charged
  http:
    url: "http://localhost:15000"
    path: "/api/budgets/status?apiKeyName=team-a"
    method: GET
  source:
    type: local
  expect:
    statusCode: 200
    bodyJsonPath:
      # $0.00903 is above the $0.008 limit, which is the overshoot the guide
      # describes: the request that crossed the limit completed and was charged.
      - path: "$.budgets[?(@.name=='daily-spend')].usage.used"
        comparator: equals
        value: "0.00903"
EOF
{{< /doc-test >}}

### Step 6: Check budget usage

Query the admin API for the current usage of a key. To return every budget, omit the `apiKeyName` parameter.

```sh {paths="apikey-budgets"}
curl -s "http://localhost:15000/api/budgets/status?apiKeyName=team-a" | jq .
```

The `used` value is a dollar amount, and it is higher than the limit, because agentgateway charged the request that crossed the limit after it completed.

Example output:

```json
{
  "observedAt": 1787773624201,
  "budgets": [
    {
      "apiKeyName": "team-a",
      "name": "daily-spend",
      "limit": {
        "unit": "USD",
        "amount": "0.008"
      },
      "usage": {
        "used": "0.00903",
        "remaining": "0",
        "exceeded": true
      },
      "window": {
        "start": 1787702400000,
        "end": 1787788800000,
        "durationMs": 86400000,
        "expired": false
      },
      "onBudgetExceeded": "Block",
      "updatedAt": 1787773623159
    }
  ]
}
```

You can also review and edit budgets in the built-in [Admin UI]({{< link-hextra path="/documentation/setup/ui/" >}}), on the same **LLM > Virtual API Keys** page that lists your keys.

### Step 7: Try a token budget

The `team-b` key that you configured in Step 2 caps tokens rather than dollars, and it uses the `Audit` action. An `Audit` budget records usage and logs the overage, but it never rejects a request. Use an `Audit` budget to size a limit before you enforce it, or to alert on a team that goes over its allocation without interrupting its work.

1. Send four requests with the `team-b` key. Each request uses 101 tokens, so four requests use more than the 250-token limit allows.

   ```sh {paths="apikey-budgets"}
   for i in 1 2 3 4; do
     curl -s -o /dev/null -w "request $i: %{http_code}\n" http://localhost:4000/v1/chat/completions \
       -H "Authorization: Bearer sk-team-b-xyz789uvw012" \
       -H "Content-Type: application/json" \
       -d '{
         "model": "gpt-5",
         "max_tokens": 100,
         "messages": [{"role": "user", "content": "Hello!"}]
       }'
   done
   ```

   Every request succeeds, even after the key passes its limit.

   Example output:

   ```
   request 1: 200
   request 2: 200
   request 3: 200
   request 4: 200
   ```

2. Check the gateway logs. Agentgateway logs each request that it receives while the budget is over its limit, so you can alert on the `budget` target in your log pipeline. A `Tokens` budget reports its amounts as whole tokens.

   ```
   warn budget API key budget exceeded api_key="team-b" budget="daily-tokens" used=303 limit_unit="Tokens" limit_amount=250 exceeded=true
   ```

{{< doc-test paths="apikey-budgets" >}}
sleep 2
YAMLTest -f - <<'EOF'
- name: an Audit budget reports itself as exceeded
  http:
    url: "http://localhost:15000"
    path: "/api/budgets/status?apiKeyName=team-b"
    method: GET
  source:
    type: local
  expect:
    statusCode: 200
    bodyJsonPath:
      - path: "$.budgets[?(@.name=='daily-tokens')].usage.exceeded"
        comparator: equals
        value: true

- name: an Audit budget still returns 200 after the limit is passed
  http:
    url: "http://localhost:4000"
    path: /v1/chat/completions
    method: POST
    headers:
      content-type: application/json
      Authorization: "Bearer sk-team-b-xyz789uvw012"
    body: |
      {
        "model": "gpt-5",
        "max_tokens": 100,
        "messages": [{"role": "user", "content": "Hello!"}]
      }
  source:
    type: local
  expect:
    statusCode: 200
EOF
{{< /doc-test >}}

## Limit model access per key

The `allowedModels` field limits which models an API key can reach. The field is independent of budgets, so it needs no database and no catalog, and you can use it on its own.

```yaml
llm:
  policies:
    apiKey:
      mode: strict
      keys:
      - key: sk-team-a-abc123def456
        metadata:
          name: team-a
        allowedModels:
        - "gpt-5*"
        - claude-sonnet-5
```

Each entry is an exact model name or a pattern with one `*` wildcard, such as a `gpt-5*` prefix or a `*-mini` suffix. Agentgateway rejects a request for any other model with a `403` response and the `model_not_allowed` code, before the request reaches a provider.

| Value | Effect |
| -- | -- |
| The field is omitted | The key can reach every model that the gateway serves. This is the default. |
| An empty list | The key can reach no models. Agentgateway rejects every LLM request from the key. |
| `["*"]` | The key can reach every model. You cannot combine `*` with another pattern in the same list. |

The field also filters the model list that the key sees. A request to `/v1/models` returns only the models that the key is allowed to use. For example, a gateway names three models individually rather than with the `"*"` pattern that Step 2 uses.

```yaml
llm:
  models:
  - name: gpt-5
    # ...
  - name: gpt-5-mini
    # ...
  - name: claude-sonnet-5
    # ...
```

A key with `allowedModels: ["gpt-5*"]` sees `gpt-5` and `gpt-5-mini`. A key with no `allowedModels` sees all three. A key with an empty list sees none. Agentgateway returns a model that you configure as a pattern, such as `"*"`, as that pattern rather than as expanded names.

<!-- TODO troubleshooting

## Troubleshooting

### A dollar budget never rejects a request

**What is happening:**

A `USD` budget stays at zero usage, and requests keep returning `200`. The admin API reports `"used": "0"` for the budget.

**Why it is happening:**

No model cost catalog prices the model that the key uses, so agentgateway has no cost to charge. Agentgateway does not report an error for this.

**How to fix it:**

1. Add a catalog entry for every model that the key can reach, as in Step 1.
2. Confirm that the access log records `agw.ai.usage.cost.total`.

An invalid catalog file only logs a warning at startup, so check the logs for `model catalog load failed` as well. To cap usage without a catalog, use a `Tokens` budget instead.

### Agentgateway refuses to start

**What is happening:**

Agentgateway exits at startup with one of the following errors.

```
Error: API key budgets require config.database to be configured
```

```
Error: API keys with budgets must have a metadata.name
```

**Why it is happening:**

A budget stores its running count in a database and identifies its key by name. Neither is optional.

**How to fix it:**

1. Add a `config.database.url` to your configuration.
2. Add a `metadata.name` to every key that has a budget.

### Usage is higher than the limit

**What is happening:**

The admin API reports a `used` value that is higher than the budget's `amount`.

**Why it is happening:**

Agentgateway charges usage after the LLM response returns, so it charges the request that crosses the limit in full. Several replicas increase the overshoot further. Each replica flushes its count to the database every five seconds, so a burst can spend against a stale count.

**How to fix it:**

This behavior is expected. Set the limit below the ceiling that you want. Size the gap to your largest expected response.

-->

## Clean up

1. Stop agentgateway with `Ctrl+C`.
2. Remove the budget database, the catalog, and the configuration file.

   ```sh
   rm -f budgets.db catalog.json config.yaml
   ```

## What's next

- Cap tokens with a bucket instead, with [rate limit token budgets]({{< link-hextra path="/documentation/llm/cost-controls/budget-limits/rate-limit/" >}}).
- Price your traffic with a [model cost catalog]({{< link-hextra path="/documentation/llm/cost-controls/costs/" >}}).
- Review the API key policy fields in [API key authentication]({{< link-hextra path="/documentation/configuration/security/apikey-authn/" >}}).
