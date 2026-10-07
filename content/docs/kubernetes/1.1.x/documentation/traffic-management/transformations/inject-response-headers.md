---
title: Inject response headers
weight: 5
description: Extract values from a request header and inject it as a header to your response.
test:
  inject-response-headers:
  - file: content/docs/kubernetes/latest/documentation/quickstart/install.md
    path: experimental
  - file: content/docs/kubernetes/latest/documentation/setup/gateway.md
    path: all
  - file: content/docs/kubernetes/latest/documentation/install/sample-app.md
    path: install-httpbin
  - file: content/docs/kubernetes/latest/documentation/traffic-management/transformations/inject-response-headers.md
    path: inject-response-headers
---

{{< reuse "agw-docs/pages/traffic-management/transformations/inject-response-headers.md" >}}
