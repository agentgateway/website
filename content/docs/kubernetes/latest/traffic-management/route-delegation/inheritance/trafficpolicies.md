---
title: AgentgatewayPolicy resources
weight: 20
description: Learn how policies in `AgentgatewayPolicy` resources are inherited and overridden along the route delegation chain.
test:
  trafficpolicies:
  - file: content/docs/kubernetes/main/quickstart/install.md
    path: experimental
  - file: content/docs/kubernetes/main/setup/gateway.md
    path: all
  - file: content/docs/kubernetes/main/traffic-management/route-delegation/inheritance/trafficpolicies.md
    path: route-delegation-prereq
  - file: content/docs/kubernetes/main/traffic-management/route-delegation/inheritance/trafficpolicies.md
    path: trafficpolicies
---

{{< reuse "agw-docs/pages/traffic-management/route-delegation/inheritance/trafficpolicies.md" >}}
