---
title: Control spend
weight: 50
description: Control cost with token budgets and spend limits to prevent unexpected bills and LLM misuse.
aliases:
  - /llm/spending/
---

In addition to tracking token consumption, Agentgateway can track LLM *spend* by mapping the token counts, model, and provider to compute a per-request cost.

{{< callout type="info" >}}
Cost analysis is best-effort and may not exactly match your provider bill in scenarios like price changes, custom pricing, failed requests, etc.
{{< /callout >}}

## Configure a model catalog

To enable costs, Agentgateway needs a _model catalog_.
Use `config.modelCatalog` to load one or more model cost catalog files.
Catalog entries are merged in order, and later entries take precedence.
This lets you start with an imported public catalog and then layer local overrides for custom prices, internal models, or provider-specific contracts.

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

After the catalog is loaded, LLM logs, traces, and metrics include cost data for requests whose provider and model match an entry in the catalog.
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

## Import costs in the UI

You can also add model costs from the Admin UI.

1. Open the [Admin UI cost page](http://localhost:15000/ui/llm/costs).
2. Press "Refresh base costs"

This will fetch the most recent costs, and configure the `modelCatalog`.
Refreshing can be done again to fetch latest data and models.

When setting up a fresh configuration for the first time, the UI will automatically do this step.

## Override catalog entries

If your provider pricing differs from the imported public catalog, add another catalog file after the imported one. Later catalog sources override earlier sources.

```yaml
config:
  modelCatalog:
  - file: ./costs/catalog.json
  - file: ./costs/overrides.json
```

Use overrides for contracted pricing, internally hosted models, or models that do not appear in the imported catalog.
