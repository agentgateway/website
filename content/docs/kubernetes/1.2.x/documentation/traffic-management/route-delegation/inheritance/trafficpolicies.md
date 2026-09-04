---
title: AgentgatewayPolicy resources
weight: 20
description: Learn how policies in `AgentgatewayPolicy` resources are inherited and overridden along the route delegation chain.
test:
  trafficpolicies:
  - file: content/docs/kubernetes/latest/documentation/quickstart/install.md
    path: experimental
  - file: content/docs/kubernetes/latest/documentation/setup/gateway.md
    path: all
  - file: content/docs/kubernetes/latest/documentation/traffic-management/route-delegation/inheritance/trafficpolicies.md
    path: route-delegation-prereq
  - file: content/docs/kubernetes/latest/documentation/traffic-management/route-delegation/inheritance/trafficpolicies.md
    path: trafficpolicies
---

{{< reuse "agw-docs/pages/traffic-management/route-delegation/inheritance/trafficpolicies.md" >}}
