---
title: Model costs
weight: 20
description: Price LLM requests with a model cost catalog and expose realized USD costs in logs, traces, metrics, and CEL policies.
test:
  costs:
  - file: ${versionRoot}/documentation/llm/cost-controls/costs.md
    path: costs
# This page absorbed the old `llm/spending.md`. Aliases are relative to the parent
# of this page's URL, so a copied version tree redirects inside itself. Do not write
# `/docs/<section>/<version>/...`: that prefix goes stale when the tree is copied
# for a release. A bare `/...` alias builds at the site root, where every version
# tree collides.
aliases:
  - ../../../llm/spending/
---

{{< reuse "agw-docs/standalone/cost-catalog.md" >}}
