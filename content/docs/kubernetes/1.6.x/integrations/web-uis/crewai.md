---
title: CrewAI
weight: 15
description: Route CrewAI multi-agent LLM traffic through agentgateway running in Kubernetes.
test:
  crewai-k8s:
  - file: ${versionRoot}/documentation/install/helm.md
    path: standard
  - file: ${versionRoot}/documentation/setup/gateway.md
    path: all
  - file: ${versionRoot}/integrations/web-uis/crewai.md
    path: crewai-k8s
---

{{< reuse "agw-docs/pages/agentgateway/integrations/web-uis-k8s/crewai.md" >}}
