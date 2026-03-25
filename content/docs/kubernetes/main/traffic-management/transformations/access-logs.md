---
title: Enrich access logs
weight: 120
description: Log CEL context variables to access logs to inspect and debug transformation expressions at runtime.
test:
  access-logs:
  - file: content/docs/kubernetes/main/quickstart/install.md
    path: experimental
  - file: content/docs/kubernetes/main/setup/gateway.md
    path: all
  - file: content/docs/kubernetes/main/install/sample-app.md
    path: install-httpbin
  - file: content/docs/kubernetes/main/traffic-management/transformations/access-logs.md
    path: access-logs
  access-logs-filter:
  - file: content/docs/kubernetes/main/quickstart/install.md
    path: experimental
  - file: content/docs/kubernetes/main/setup/gateway.md
    path: all
  - file: content/docs/kubernetes/main/install/sample-app.md
    path: install-httpbin
  - file: content/docs/kubernetes/main/traffic-management/transformations/access-logs.md
    path: access-logs-filter
---

{{< reuse "agw-docs/pages/traffic-management/transformations/access-logs.md" >}}
