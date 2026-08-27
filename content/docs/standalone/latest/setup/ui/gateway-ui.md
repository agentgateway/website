---
title: Serve the UI on a gateway
weight: 20
description: Give the UI a gateway of its own so that UI traffic and proxy traffic do not share a port.
test:
  ui-gateway:
  - file: ${versionRoot}/setup/ui/gateway-ui.md
    path: ui-standalone-gateway
---

{{< reuse "agw-docs/standalone/setup/ui/gateway.md" >}}
