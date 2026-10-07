---
title: Access logging
weight: 10
description: Capture an access log for all the requests that enter the proxy.
test:
  access-logging:
  - file: ${versionRoot}/documentation/quickstart/install.md
    path: standard
  - file: ${versionRoot}/documentation/setup/gateway.md
    path: all
  - file: ${versionRoot}/documentation/install/sample-app.md
    path: install-httpbin
  - file: ${versionRoot}/documentation/security/access-logging.md
    path: access-logging
---

{{< reuse "agw-docs/pages/security/access-logging.md" >}}