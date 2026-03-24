---
title: Path redirects
weight: 443
description: Redirect requests to a different path prefix.
test:
  path-redirect-prefix:
  - file: content/docs/kubernetes/main/quickstart/install.md
    path: experimental
  - file: content/docs/kubernetes/main/setup/gateway.md
    path: all
  - file: content/docs/kubernetes/main/install/sample-app.md
    path: install-httpbin
  - file: content/docs/kubernetes/main/traffic-management/redirect/path.md
    path: path-redirect-prefix
  path-redirect-full:
  - file: content/docs/kubernetes/main/quickstart/install.md
    path: experimental
  - file: content/docs/kubernetes/main/setup/gateway.md
    path: all
  - file: content/docs/kubernetes/main/install/sample-app.md
    path: install-httpbin
  - file: content/docs/kubernetes/main/traffic-management/redirect/path.md
    path: path-redirect-full
---

{{< reuse "agw-docs/pages/traffic-management/redirect/path.md" >}}