---
title: View and customize access logs
weight: 10
description: Configure per-request structured access logs with CEL-based filtering and field enrichment.
test:
  access-logging:
  - file: ${versionRoot}/documentation/quickstart/install.md
    path: standard
  - file: ${versionRoot}/documentation/setup/gateway.md
    path: all
  - file: ${versionRoot}/documentation/install/sample-app.md
    path: install-httpbin
  - file: ${versionRoot}/documentation/observability/access-logs/view.md
    path: access-logging
---

{{< reuse "agw-docs/pages/security/access-logging.md" >}}
