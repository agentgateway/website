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

## Check priced traffic with agctl

After sending an LLM request, use [agctl]({{< link-hextra path="/documentation/operations/agctl/" >}}) to inspect recorded costs. These commands require a [request-log database]({{< link-hextra path="/documentation/observability/access-logs/database/" >}}).

```sh
agctl standalone logs --limit 10
agctl standalone analytics --by provider,model --since 1h
```

The log table shows cost per request, and analytics aggregates the recorded cost. A zero total alone does not prove that every request was priced; review the catalog lookup metrics above when troubleshooting missing pricing. For time buckets and identity breakdowns, see [CLI analytics]({{< link-hextra path="/documentation/llm/cost-controls/dashboard/#cli" >}}).
