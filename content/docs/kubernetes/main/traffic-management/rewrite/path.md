---
title: Path rewrites
weight: 462
description: Rewrite path prefixes in requests.
test:
  path-rewrite-prefix:
  - file: content/docs/kubernetes/main/quickstart/install.md
    path: experimental
  - file: content/docs/kubernetes/main/setup/gateway.md
    path: all
  - file: content/docs/kubernetes/main/install/sample-app.md
    path: install-httpbin
  - file: content/docs/kubernetes/main/traffic-management/rewrite/path.md
    path: path-rewrite-prefix
  path-rewrite-full:
  - file: content/docs/kubernetes/main/quickstart/install.md
    path: experimental
  - file: content/docs/kubernetes/main/setup/gateway.md
    path: all
  - file: content/docs/kubernetes/main/install/sample-app.md
    path: install-httpbin
  - file: content/docs/kubernetes/main/traffic-management/rewrite/path.md
    path: path-rewrite-full
---

{{< reuse "agw-docs/pages/traffic-management/rewrite/path.md" >}}
