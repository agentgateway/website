---
title: AgentgatewayPolicy resources
weight: 20
description: Learn how policies in `AgentgatewayPolicy` resources are inherited and overridden along the route delegation chain.
test:
  trafficpolicies:
  - file: ${versionRoot}/quickstart/install.md
    path: experimental
  - file: ${versionRoot}/setup/gateway.md
    path: all
  - file: ${versionRoot}/traffic-management/route-delegation/inheritance/trafficpolicies.md
    path: route-delegation-prereq
  - file: ${versionRoot}/traffic-management/route-delegation/inheritance/trafficpolicies.md
    path: trafficpolicies
---

{{< reuse "agw-docs/pages/traffic-management/route-delegation/inheritance/trafficpolicies.md" >}}
