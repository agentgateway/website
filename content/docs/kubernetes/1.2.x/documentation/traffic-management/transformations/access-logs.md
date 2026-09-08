---
title: Enrich access logs
weight: 120
description: Log CEL context variables to access logs to inspect and debug transformation expressions at runtime.
test:
  access-logs:
  - file: content/docs/kubernetes/latest/documentation/quickstart/install.md
    path: experimental
  - file: content/docs/kubernetes/latest/documentation/setup/gateway.md
    path: all
  - file: content/docs/kubernetes/latest/documentation/install/sample-app.md
    path: install-httpbin
  - file: content/docs/kubernetes/latest/documentation/traffic-management/transformations/access-logs.md
    path: access-logs
  access-logs-filter:
  - file: content/docs/kubernetes/latest/documentation/quickstart/install.md
    path: experimental
  - file: content/docs/kubernetes/latest/documentation/setup/gateway.md
    path: all
  - file: content/docs/kubernetes/latest/documentation/install/sample-app.md
    path: install-httpbin
  - file: content/docs/kubernetes/latest/documentation/traffic-management/transformations/access-logs.md
    path: access-logs-filter
---

{{< reuse "agw-docs/pages/traffic-management/transformations/access-logs.md" >}}
