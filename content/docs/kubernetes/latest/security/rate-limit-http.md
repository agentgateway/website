---
title: Local rate limiting
weight: 40
description: Apply local and global rate limits to HTTP traffic to protect your backend services from overload.
test:
  local-rate-limit:
  - file: ${versionRoot}/install/helm.md
    path: standard
  - file: ${versionRoot}/setup/gateway.md
    path: all
  - file: ${versionRoot}/install/sample-app.md
    path: install-httpbin
  - path: local-rate-limit
---

{{< reuse "agw-docs/pages/security/rate-limit-http.md" >}}
