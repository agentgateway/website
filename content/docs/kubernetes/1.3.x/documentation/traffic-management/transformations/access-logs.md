---
title: Enrich access logs
weight: 120
description: Log CEL context variables to access logs to inspect and debug transformation expressions at runtime.
test:
  access-logs:
  - file: ${versionRoot}/documentation/quickstart/install.md
    path: experimental
  - file: ${versionRoot}/documentation/setup/gateway.md
    path: all
  - file: ${versionRoot}/documentation/install/sample-app.md
    path: install-httpbin
  - file: ${versionRoot}/documentation/traffic-management/transformations/access-logs.md
    path: access-logs
  access-logs-filter:
  - file: ${versionRoot}/documentation/quickstart/install.md
    path: experimental
  - file: ${versionRoot}/documentation/setup/gateway.md
    path: all
  - file: ${versionRoot}/documentation/install/sample-app.md
    path: install-httpbin
  - file: ${versionRoot}/documentation/traffic-management/transformations/access-logs.md
    path: access-logs-filter
---

{{< reuse "agw-docs/pages/traffic-management/transformations/access-logs.md" >}}
