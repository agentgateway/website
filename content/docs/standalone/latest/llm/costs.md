---
title: Model costs
weight: 51
description: Price LLM requests with a model cost catalog and expose realized USD costs in logs, traces, metrics, and CEL policies.
test:
  costs:
  - file: ${versionRoot}/llm/costs.md
    path: costs
aliases:
  - /llm/spending/
---

Agentgateway can track LLM spend by mapping each request's provider, model, and token counts to per-token pricing.

Agentgateway extracts token usage from supported LLM APIs automatically. To convert those token counts into cost, configure a model cost catalog. The catalog maps provider and model names to pricing data so agentgateway can attach realized USD cost to logs, traces, metrics, and CEL expressions.

{{< callout type="info" >}}
Cost analysis is best-effort and may not exactly match your provider bill in scenarios such as price changes, custom pricing, failed requests, or provider-specific billing rules.
{{< /callout >}}

## Configure a model catalog

Use `config.modelCatalog` to load one or more model cost catalog files. Catalog entries are merged in order, and later entries take precedence. This lets you start with an imported public catalog and then layer local overrides for contracted pricing, internal models, or provider-specific aliases.

```yaml
# yaml-language-server: $schema=https://agentgateway.dev/schema/config

config:
  modelCatalog:
  - file: ./costs/catalog.json

llm:
  models:
  - name: "*"
    provider: openAI
    params:
      apiKey: "$OPENAI_API_KEY"
```

Run agentgateway with the config file.

```sh
agentgateway -f config.yaml
```

After the catalog is loaded, priced requests include cost data. The access log includes `agw.ai.usage.cost.total`, and CEL exposes cost data as `llm.cost` and `llm.costRates`.

For general LLM telemetry setup, see [Observe traffic]({{< link-hextra path="/llm/observability/" >}}).

## Import costs with agctl

Use `agctl costs import` to generate a catalog file from a supported pricing source. The default source is `models.dev`.

```sh
mkdir -p costs
agctl costs import --out ./costs/catalog.json
```

To keep the catalog smaller, import only the providers that you use.

```sh
agctl costs import \
  --source models.dev \
  --providers anthropic,google,openai \
  --out ./costs/catalog.json
```

For all flags, see the [`agctl costs import`]({{< link-hextra path="/reference/agctl/agctl-costs-import/" >}}) reference.

## Import costs in the UI

You can also import model costs from the Admin UI.

1. Open the [Admin UI cost page](http://localhost:15000/ui/llm/costs).
2. Press **Refresh base costs**.

The UI fetches the latest base costs and configures `modelCatalog`. You can refresh again later to pull updated pricing and model data.

When you set up a fresh configuration for the first time, the UI automatically performs this step.

## Override catalog entries

If your provider pricing differs from the imported public catalog, add another catalog file after the imported one. Later catalog sources override earlier sources.

```yaml
config:
  modelCatalog:
  - file: ./costs/catalog.json
  - file: ./costs/overrides.json
```

Use overrides for contracted pricing, internally hosted models, or models that do not appear in the imported catalog.

You can also load one or more catalog files with the `MODEL_CATALOG_PATHS` environment variable. Set it to a comma-separated list of file paths.

```sh
MODEL_CATALOG_PATHS=./costs/catalog.json,./costs/overrides.json agentgateway -f config.yaml
```

{{< callout type="warning" >}}
When `MODEL_CATALOG_PATHS` is set, it replaces any `config.modelCatalog` sources. Use one mechanism or the other.
{{< /callout >}}

## Use cost data

When a request matches an entry in the catalog, agentgateway populates these CEL fields:

- `llm.cost`: The realized USD cost of the request. Includes `total` plus per-token-type components such as `input`, `output`, `cacheRead`, `cacheWrite`, `reasoning`, `inputAudio`, and `outputAudio`. Unset when the model cannot be priced.
- `llm.costRates`: The effective USD-per-1,000,000-token rates that were applied. Includes the same per-token-type fields when available. Unset when the model cannot be priced.

The request access log always includes `agw.ai.usage.cost.total` for LLM requests when a cost is available.
Traces always include the full breakdown:
* `agw.ai.usage.cost.total`
* `agw.ai.usage.cost.input`
* `agw.ai.usage.cost.output`
* `agw.ai.usage.cost.cache_read`
* `agw.ai.usage.cost.cache_write`
* `agw.ai.usage.cost.reasoning`
* `agw.ai.usage.cost.input_audio`
* `agw.ai.usage.cost.output_audio`

As these are loaded into the CEL context, they can be explicitly emited as well

```yaml
# yaml-language-server: $schema=https://agentgateway.dev/schema/config
frontendPolicies:
  accessLog:
    add:
       # Add the input cost
       input_cost: llm.cost.input
       # Add ALL cost variables, as `cost.input`, `cost.output`, etc.
       cost: flatten(llm.cost)
```

A priced request produces an access log entry that includes cost data.

```console
... protocol=llm gen_ai.provider.name=openai gen_ai.request.model=gpt-4o-mini
gen_ai.usage.input_tokens=14 gen_ai.usage.output_tokens=6 agw.ai.usage.cost.total=0.0000057 ...
```

## Monitor catalog lookups

Every cost lookup increments the `agentgateway_cost_catalog_lookups_total` counter. The metric is labeled with lookup `status`, provider, request model, and response model.

| Status | Meaning |
|--------|---------|
| `Exact` | The provider and model were found in the catalog and priced. |
| `Unpriced` | The model was found, but the token types in the request had no matching rates. |
| `Missing` | The provider or model was not found in the catalog. |
| `NoCatalog` | No catalog is configured. |

A rising `Missing` or `Unpriced` count means requests are flowing through models that your catalog does not price. Add the missing providers or models to your catalog and reload.

{{< callout type="info" >}}
In traces, the corresponding cost-resolution `status` attribute uses lowercase values: `exact`, `unpriced`, `missing`, and `noCatalog`.
{{< /callout >}}

## Enforce budgets

The model catalog provides pricing data for spend visibility. To block or throttle traffic, combine cost visibility with rate limiting or virtual key management.

- Use [Rate limiting]({{< link-hextra path="/configuration/resiliency/rate-limits/" >}}) to cap request or token usage per route, user, or API key.
- Use [Virtual keys]({{< link-hextra path="/llm/virtual-keys/" >}}) to issue keys with per-key controls and attribution.

## Advanced: Catalog format

Usually, you do not need to write catalog JSON by hand. Use `agctl costs import` or the Admin UI to generate the base catalog, then add overrides only when needed.

{{< reuse "agw-docs/snippets/model-catalog-json-format.md" >}}

The following minimal example prices one OpenAI model and one tiered Gemini model.

```json
{
  "providers": {
    "openai": {
      "models": {
        "gpt-4o-mini": {
          "rates": { "input": "0.15", "output": "0.6", "cacheRead": "0.075" }
        }
      }
    },
    "gcp.gemini": {
      "models": {
        "gemini-2.5-pro": {
          "rates": { "input": "1.25", "output": "10", "cacheRead": "0.125" },
          "tiers": [
            {
              "contextOver": 200000,
              "rates": { "input": "2.5", "output": "15", "cacheRead": "0.25" }
            }
          ]
        }
      }
    }
  }
}
```

{{< doc-test paths="costs" >}}
# Verify that agentgateway loads a catalog from a file source.
cat > /tmp/costs-catalog.json <<'EOF'
{
  "providers": {
    "openai": {
      "models": {
        "gpt-4o-mini": {
          "rates": { "input": "0.15", "output": "0.6", "cacheRead": "0.075" }
        }
      }
    }
  }
}
EOF
cat > /tmp/costs-config.yaml <<'EOF'
config:
  modelCatalog:
  - file: /tmp/costs-catalog.json
llm:
  models:
  - name: gpt-4o-mini
    provider: openAI
    params:
      apiKey: "$OPENAI_API_KEY"
EOF
agentgateway -f /tmp/costs-config.yaml > /tmp/costs-agw.log 2>&1 &
AGW_PID=$!
trap 'kill $AGW_PID 2>/dev/null' EXIT
sleep 3
grep -q "loaded model catalog" /tmp/costs-agw.log
{{< /doc-test >}}
