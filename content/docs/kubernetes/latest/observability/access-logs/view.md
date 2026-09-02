---
title: View and customize access logs
weight: 10
description: Configure per-request structured access logs with CEL-based filtering and field enrichment.
test:
  access-logging:
  - file: ${versionRoot}/quickstart/install.md
    path: standard
  - file: ${versionRoot}/setup/gateway.md
    path: all
  - file: ${versionRoot}/install/sample-app.md
    path: install-httpbin
  - file: ${versionRoot}/observability/access-logs/view.md
    path: access-logging
---

{{< reuse "agw-docs/pages/security/access-logging.md" >}}
