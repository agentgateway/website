---
title: Model costs
weight: 20
description: Price LLM requests with a model cost catalog and expose realized USD costs in logs, traces, metrics, and CEL policies.
test:
  costs:
  - file: ${versionRoot}/documentation/llm/cost-controls/costs.md
    path: costs
# This page absorbed the old `llm/spending.md`. Aliases are WHOLE URL paths, so
# keep the `/docs/standalone/latest` prefix. Without it, the redirect builds at the
# site root and collides with the identical alias in `main`, and whichever tree
# builds last wins.
aliases:
  - /docs/standalone/latest/llm/spending/
---

{{< reuse "agw-docs/standalone/cost-catalog.md" >}}
