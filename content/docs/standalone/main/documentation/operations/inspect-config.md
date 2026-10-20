---
title: Inspect agentgateway configuration
weight: 17
description: Inspect the runtime configuration that a standalone agentgateway instance has loaded.
test: skip
---

> [!WARNING]
> {{< reuse "agw-docs/snippets/feature-experimental.md">}}

{{< reuse "agw-docs/pages/operations/inspect-config-standalone.md" >}}

## Inspect managed resources with agctl

For a quick view of standalone configuration resources, query the resource API directly.

```sh
agctl standalone get all
agctl standalone get llm.model -o yaml
agctl standalone get traffic.route -o yaml
```

This view shows saved resource definitions. It does not show runtime endpoint health or the translated configuration from `/config_dump`. In hybrid mode, it lists database-managed resources only. Use the config dump workflow above to investigate what the proxy actually loaded. For resource kinds and storage behavior, see [Manage config resources]({{< link-hextra path="/documentation/operations/config-resources/" >}}).
