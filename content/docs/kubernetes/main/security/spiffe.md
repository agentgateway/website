---
title: SPIFFE workload identity
weight: 5
description: Source the TLS identity of your gateway from the SPIFFE Workload API instead of a Kubernetes Secret.
test:
  spiffe:
  - file: ${versionRoot}/quickstart/install.md
    path: experimental
  - file: ${versionRoot}/security/spiffe.md
    path: spiffe
---

{{< reuse "agw-docs/pages/security/spiffe.md" >}}
