---
title: Local rate limiting
weight: 40
description: Apply local and global rate limits to HTTP traffic to protect your backend services from overload.
test:
  local-rate-limit:
  - file: content/docs/kubernetes/main/install/helm.md
    path: standard
  - file: content/docs/kubernetes/main/setup/gateway.md
    path: all
  - file: content/docs/kubernetes/main/install/sample-app.md
    path: install-httpbin
  - file: content/docs/kubernetes/main/security/rate-limit-http.md
    path: local-rate-limit
---

{{< reuse "agw-docs/pages/security/rate-limit-http.md" >}}
