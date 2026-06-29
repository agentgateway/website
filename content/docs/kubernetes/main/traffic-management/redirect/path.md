---
title: Path redirects
weight: 443
description: Redirect requests to a different path prefix.
test:
  path-redirect-prefix:
  - file: ${versionRoot}/quickstart/install.md
    path: experimental
  - file: ${versionRoot}/setup/gateway.md
    path: all
  - file: ${versionRoot}/install/sample-app.md
    path: install-httpbin
  - path: path-redirect-prefix
  path-redirect-full:
  - file: ${versionRoot}/quickstart/install.md
    path: experimental
  - file: ${versionRoot}/setup/gateway.md
    path: all
  - file: ${versionRoot}/install/sample-app.md
    path: install-httpbin
  - path: path-redirect-full
---

{{< reuse "agw-docs/pages/traffic-management/redirect/path.md" >}}