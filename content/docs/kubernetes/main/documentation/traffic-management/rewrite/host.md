---
title: Host rewrites
weight: 461
description: Replace the host header value before forwarding a request to a backend service.
test:
  host-rewrite:
    type: functional
    steps:
    - file: ${versionRoot}/documentation/quickstart/install.md
      path: experimental
    - file: ${versionRoot}/documentation/setup/gateway.md
      path: all
    - file: ${versionRoot}/documentation/install/sample-app.md
      path: install-httpbin
    - file: ${versionRoot}/documentation/traffic-management/rewrite/host.md
      path: host-rewrite
      assert:
      - products/agentgateway/main/traffic-management/rewrite/host-rewrite-wait.sh
      - products/agentgateway/main/traffic-management/rewrite/host-rewrite-warmup.sh
      - products/agentgateway/main/traffic-management/rewrite/host-rewrite-assert.sh
---

{{< reuse "agw-docs/pages/traffic-management/rewrite/host.md" >}}
