---
title: Path rewrites
weight: 462
description: Rewrite path prefixes in requests.
test:
  path-rewrite-prefix:
  - file: ${versionRoot}/quickstart/install.md
    path: experimental
  - file: ${versionRoot}/setup/gateway.md
    path: all
  - file: ${versionRoot}/install/sample-app.md
    path: install-httpbin
  - file: ${versionRoot}/traffic-management/rewrite/path.md
    path: path-rewrite-prefix
  path-rewrite-full:
  - file: ${versionRoot}/quickstart/install.md
    path: experimental
  - file: ${versionRoot}/setup/gateway.md
    path: all
  - file: ${versionRoot}/install/sample-app.md
    path: install-httpbin
  - file: ${versionRoot}/traffic-management/rewrite/path.md
    path: path-rewrite-full
---

{{< reuse "agw-docs/pages/traffic-management/rewrite/path.md" >}}
