---
title: Path rewrites
weight: 462
description: Rewrite path prefixes in requests.
test:
  path-rewrite-prefix:
    type: functional
    steps:
    - file: ${versionRoot}/quickstart/install.md
      path: experimental
    - file: ${versionRoot}/setup/gateway.md
      path: all
    - file: ${versionRoot}/install/sample-app.md
      path: install-httpbin
    - file: ${versionRoot}/traffic-management/rewrite/path.md
      path: path-rewrite-prefix
      assert:
      - products/agentgateway/main/traffic-management/rewrite/path-rewrite-prefix-wait.sh
      - products/agentgateway/main/traffic-management/rewrite/path-rewrite-prefix-warmup.sh
      - products/agentgateway/main/traffic-management/rewrite/path-rewrite-prefix-assert.sh
  path-rewrite-full:
    type: functional
    steps:
    - file: ${versionRoot}/quickstart/install.md
      path: experimental
    - file: ${versionRoot}/setup/gateway.md
      path: all
    - file: ${versionRoot}/install/sample-app.md
      path: install-httpbin
    - file: ${versionRoot}/traffic-management/rewrite/path.md
      path: path-rewrite-full
      assert:
      - products/agentgateway/main/traffic-management/rewrite/path-rewrite-full-wait.sh
      - products/agentgateway/main/traffic-management/rewrite/path-rewrite-full-warmup.sh
      - products/agentgateway/main/traffic-management/rewrite/path-rewrite-full-assert.sh
---

{{< reuse "agw-docs/pages/traffic-management/rewrite/path.md" >}}
