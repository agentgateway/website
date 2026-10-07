---
title: Local rate limiting
weight: 40
description: Apply local and global rate limits to HTTP traffic to protect your backend services from overload.
test:
  local-rate-limit:
  - file: content/docs/kubernetes/latest/documentation/install/helm.md
    path: standard
  - file: content/docs/kubernetes/latest/documentation/setup/gateway.md
    path: all
  - file: content/docs/kubernetes/latest/documentation/install/sample-app.md
    path: install-httpbin
  - file: content/docs/kubernetes/latest/documentation/security/rate-limit-http.md
    path: local-rate-limit
---

{{< reuse "agw-docs/pages/security/rate-limit-http.md" >}}
