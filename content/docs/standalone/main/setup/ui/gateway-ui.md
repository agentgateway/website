---
title: Serve the UI on a gateway
weight: 20
description: Give the admin UI a gateway of its own so that UI traffic and proxy traffic do not share a port, and change the admin address.
test:
  admin-ui-custom-port:
  - file: ${versionRoot}/setup/ui/gateway-ui.md
    path: ui-standalone-custom-port
---

{{< reuse "agw-docs/standalone/setup/ui/gateway.md" >}}
