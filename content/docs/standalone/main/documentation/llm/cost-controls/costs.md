---
title: Model costs
weight: 20
description: Price LLM requests with a model cost catalog and expose realized USD costs in logs, traces, metrics, and CEL policies.
test:
  costs:
  - file: ${versionRoot}/documentation/llm/cost-controls/costs.md
    path: costs
# This page absorbed the old `llm/spending.md`. Aliases are WHOLE URL paths, so
# keep the `/docs/standalone/main` prefix. Without it, the redirect builds at the
# site root and collides with the identical alias in `latest`, and whichever tree
# builds last wins.
aliases:
  - /docs/standalone/main/llm/spending/
---

{{< reuse "agw-docs/standalone/cost-catalog.md" >}}
