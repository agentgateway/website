---
title: Enrich access logs
weight: 120
description: Log CEL context variables to access logs to inspect and debug transformation expressions at runtime.
test:
  access-logs:
    type: [schema, functional]
    steps:
    - file: ${versionRoot}/quickstart/install.md
      path: experimental
    - file: ${versionRoot}/setup/gateway.md
      path: all
    - file: ${versionRoot}/install/sample-app.md
      path: install-httpbin
    - file: ${versionRoot}/traffic-management/transformations/access-logs.md
      path: access-logs
  access-logs-filter:
    type: [schema, functional]
    steps:
    - file: ${versionRoot}/quickstart/install.md
      path: experimental
    - file: ${versionRoot}/setup/gateway.md
      path: all
    - file: ${versionRoot}/install/sample-app.md
      path: install-httpbin
    - file: ${versionRoot}/traffic-management/transformations/access-logs.md
      path: access-logs-filter
---

{{< reuse "agw-docs/pages/traffic-management/transformations/access-logs.md" >}}
