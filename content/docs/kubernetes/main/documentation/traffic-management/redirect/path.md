---
title: Path redirects
weight: 443
description: Redirect requests to a different path prefix.
test:
  path-redirect-prefix:
  - file: ${versionRoot}/documentation/quickstart/install.md
    path: experimental
  - file: ${versionRoot}/documentation/setup/gateway.md
    path: all
  - file: ${versionRoot}/documentation/install/sample-app.md
    path: install-httpbin
  - file: ${versionRoot}/documentation/traffic-management/redirect/path.md
    path: path-redirect-prefix
  path-redirect-full:
  - file: ${versionRoot}/documentation/quickstart/install.md
    path: experimental
  - file: ${versionRoot}/documentation/setup/gateway.md
    path: all
  - file: ${versionRoot}/documentation/install/sample-app.md
    path: install-httpbin
  - file: ${versionRoot}/documentation/traffic-management/redirect/path.md
    path: path-redirect-full
---

{{< reuse "agw-docs/pages/traffic-management/redirect/path.md" >}}