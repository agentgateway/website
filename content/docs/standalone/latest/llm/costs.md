---
title: Model costs
weight: 51
description: Price LLM requests with a model cost catalog and expose realized USD costs in logs, traces, metrics, and CEL policies.
# Doc tests for the `costs` scenario are authored below but skipped until the 1.3.x
# release referenced by agw-docs/versions/n-patch.md includes the model cost catalog
# (1.3.0-beta.1 or later). To enable, replace `test: skip` with:
#   test:
#     costs:
#     - file: content/docs/standalone/latest/llm/costs.md
#       path: costs
test: skip
---

Agentgateway can compute the realized USD cost of each LLM request when you provide a model cost catalog. With a catalog in place, agentgateway attributes cost per request in access logs, traces, and metrics, and exposes the values to CEL expressions as `llm.cost` and `llm.costRates`.

Agentgateway does not ship a built-in catalog. Costs are computed only when you configure one (for example, a catalog that you generate with [`agctl costs import`](#generate-a-catalog-with-agctl)).

## Before you begin

{{< reuse "agw-docs/snippets/prereq-agentgateway.md" >}}


## Step 1: Prepare a catalog

Prepare a catalog by creating your own JSON file or using the `agctl costs import` command.

### Catalog JSON format

{{< reuse "agw-docs/snippets/model-catalog-json-format.md" >}}

### Generate a catalog with agctl

Use `agctl costs import` to generate a catalog JSON file, then reference that file from `config.modelCatalog` or `MODEL_CATALOG_PATHS`.

1. Generate a catalog from a supported source. By default, `agctl costs import` imports every provider that the proxy supports from [models.dev](https://models.dev).

   ```sh
   agctl costs import --pretty --out ./catalog.json
   ```

2. To import only a subset of providers, pass a comma-separated list to `--providers`.

   ```sh
   agctl costs import --pretty --providers openai,anthropic --out ./catalog.json
   ```

3. Reference the generated file from your configuration with `config.modelCatalog[].file` or `MODEL_CATALOG_PATHS`, then run agentgateway.

For all options, see the [`agctl costs import`]({{< link-hextra path="/reference/agctl/agctl-costs-import/" >}}) reference.

## Step 2: Configure catalog sources

Configure one or more catalog sources for agentgateway with the `config.modelCatalog` config section. Sources are merged in order, with later sources taking precedence at the model level.

### Load a catalog from a file

The `file` field is a path to a catalog JSON file. Agentgateway watches the file and reloads it when it changes.

```yaml
# yaml-language-server: $schema=https://agentgateway.dev/schema/config
config:
  modelCatalog:
  - file: ./catalog.json
```

### Embed a catalog inline

The `inline` field is a string that contains the catalog JSON.

```yaml
# yaml-language-server: $schema=https://agentgateway.dev/schema/config
config:
  modelCatalog:
  - inline: |
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
```

### Load catalog files with an environment variable

You can also load one or more catalog files with the `MODEL_CATALOG_PATHS` environment variable, set to a comma-separated list of file paths. The environment variable is useful for container deployments where you mount a catalog file and enable it without editing the main configuration file.

```sh
MODEL_CATALOG_PATHS=./catalog.json,./overrides.json agentgateway -f config.yaml
```

{{< callout type="warning" >}}
When `MODEL_CATALOG_PATHS` is set, it **replaces** any `config.modelCatalog` sources; the two are not merged. Use one mechanism or the other.
{{< /callout >}}

## Step 3: Configure cost policies

Use cost data in CEL, logs, traces, and metrics policies.

When a request matches an entry in the catalog, agentgateway populates the following CEL fields:

- `llm.cost`: The realized USD cost of the request. Includes `total` plus per-token-type components: `input`, `output`, `cacheRead`, `cacheWrite`, `reasoning`, `inputAudio`, and `outputAudio`. Unset when the model cannot be priced.
- `llm.costRates`: The effective USD-per-1,000,000-token rates that were applied, after tier selection. Includes the same per-token-type fields when available. Unset when the model cannot be priced.

The request access log always includes `agw.ai.usage.cost.total` for LLM requests (it is `0` when the model cannot be priced). To add the breakdown or rate fields, reference them with CEL in access logs, traces, or metrics:

```yaml
# yaml-language-server: $schema=https://agentgateway.dev/schema/config
frontendPolicies:
  accessLog:
    add:
      llm.cost.total: 'llm.cost.total'
      llm.cost.input: 'llm.cost.input'
      llm.cost.output: 'llm.cost.output'
      llm.cost.cacheRead: 'llm.cost.cacheRead'
  tracing:
    attributes:
      llm.cost.total: 'llm.cost.total'
      llm.costRates.input: 'llm.costRates.input'
      llm.costRates.output: 'llm.costRates.output'

config:
  metrics:
    fields:
      add:
        llm.cost.total: 'llm.cost.total'
        llm.costRates.input: 'llm.costRates.input'
```

A priced request produces an access log line that includes the cost fields:

```
... protocol=llm gen_ai.provider.name=openai gen_ai.request.model=gpt-4o-mini
gen_ai.usage.input_tokens=14 gen_ai.usage.output_tokens=6 agw.ai.usage.cost.total=0.0000057 ...
```

For more examples, see [Observe traffic]({{< link-hextra path="/llm/observability/" >}}) and the [CEL reference]({{< link-hextra path="/reference/cel/cel-context" >}}).

## Step 4: Generate traffic

Generate traffic through agentgateway that matches a model entry from the catalog. For example steps, try the [LLM getting started]({{< link-hextra path="/quickstart/llm/" >}}).

## Step 5: Monitor catalog lookups

Every cost lookup increments the `agentgateway_cost_catalog_lookups_total` counter, labeled with the lookup `status` and the request's `gen_ai_system` (provider), `gen_ai_request_model`, and `gen_ai_response_model`. Use the lookup to confirm that your catalog prices your traffic.

The `status` label is one of the following values:

| Status | Meaning |
|--------|---------|
| `Exact` | The provider and model were found in the catalog and priced. |
| `Unpriced` | The model was found, but the token types in the request had no matching rates. |
| `Missing` | The provider or model was not found in the catalog. |
| `NoCatalog` | No catalog is configured. |

For example, the metrics endpoint at `http://localhost:15020/metrics` shows lines such as the following:

agentgateway_cost_catalog_lookups_total{status="Exact",gen_ai_system="openai",gen_ai_request_model="gpt-4o-mini",...} 1
agentgateway_cost_catalog_lookups_total{status="Missing",gen_ai_system="openai",gen_ai_request_model="gpt-3.5-turbo",...} 1
```

A rising `Missing` or `Unpriced` count means requests are flowing through models that your catalog does not price. Add the missing providers or models to your catalog and reload.

{{< callout type="info" >}}
In traces, the corresponding cost-resolution `status` attribute uses lowercase values: `exact`, `unpriced`, `missing`, and `noCatalog`.
{{< /callout >}}

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
