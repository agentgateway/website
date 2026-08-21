---
title: Admin UI
weight: 20
description: Open, expose, and secure the built-in agentgateway admin UI in each installation method.
aliases:
  - /docs/standalone/main/deployment/helm/ui/
  - /docs/standalone/main/operations/ui/
test:
  admin-ui-default-port:
  - file: ${versionRoot}/setup/ui.md
    path: ui-standalone-default
  admin-ui-custom-port:
  - file: ${versionRoot}/setup/ui.md
    path: ui-standalone-custom-port
---

{{< reuse "agw-docs/standalone/setup/ui.md" >}}
