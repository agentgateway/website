---
title: Access logging
weight: 10
description: Capture an access log for all the requests that enter the proxy.
test:
  access-logging:
  - file: ${versionRoot}/quickstart/install.md
    path: standard
  - file: ${versionRoot}/setup/gateway.md
    path: all
  - file: ${versionRoot}/install/sample-app.md
    path: install-httpbin
  - path: access-logging
---

{{< reuse "agw-docs/pages/security/access-logging.md" >}}