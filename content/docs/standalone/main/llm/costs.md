---
title: Model costs
weight: 51
description: Price LLM requests with a model cost catalog and expose realized USD costs in logs, traces, metrics, and CEL policies.
---

Agentgateway can compute **realized USD cost** for LLM requests when you provide a **model cost catalog**. This enables per-request cost attribution in access logs, traces, and metrics, and lets you write CEL expressions against `llm.cost` and `llm.costRates`.

Agentgateway does **not** ship a built-in model catalog. You must provide one (for example, generated with `agctl costs import`).

## Configure catalog sources

Configure one or more catalog sources under `config.modelCatalog`. Entries are merged in order, with later entries taking precedence.

### Load a catalog from a file

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

## Catalog JSON format

A model cost catalog is JSON with this high-level structure:

```json
{
  "providers": {
    "<provider-id>": {
      "models": {
        "<model-name>": {
          "rates": {
            "input": "0.0",
            "output": "0.0",
            "cacheRead": "0.0",
            "cacheWrite": "0.0",
            "reasoning": "0.0",
            "inputAudio": "0.0",
            "outputAudio": "0.0"
          },
          "tiers": [
            {
              "contextOver": 200000,
              "rates": {
                "input": "0.0",
                "output": "0.0"
              }
            }
          ]
        }
      }
    }
  }
}
```

Key points:

- Rates are **strings** (exact decimals), in **USD per 1,000,000 tokens**.
- If a rate is omitted, that token type is not priced for the model.
- `tiers[]` is optional. Each tier:
  - selects alternate `rates` when the request context is **over** `contextOver`
  - must be ordered by strictly increasing `contextOver`

## Load catalog files via environment variable

You can also load one or more catalog files via the `MODEL_CATALOG_PATHS` environment variable (comma-separated list of file paths). This is useful for container deployments where you mount a catalog file and want to enable it without editing the main configuration file.

## Generate a catalog with agctl

Use `agctl costs import` to generate a catalog JSON file.

```sh
agctl costs import --pretty --out ./catalog.json
```

To import a subset of providers:

```sh
agctl costs import --pretty --providers openai,anthropic --out ./catalog.json
```

For all options, see the [`agctl costs import`]({{< link-hextra path="/reference/agctl/agctl-costs-import/" >}}) reference.

## Use costs in CEL, logs, traces, and metrics

When a request matches an entry in the catalog, agentgateway populates:

- `llm.cost` — realized USD cost for the request (unset when the model cannot be priced)
- `llm.costRates` — effective USD-per-1M-token rates after tier selection (unset when the model cannot be priced)

You can use these in CEL expressions for access logging, tracing, and metrics configuration. For examples, see [LLM observability]({{< link-hextra path="/llm/observability/" >}}) and the [CEL reference]({{< link-hextra path="/reference/cel/cel-context" >}}).
