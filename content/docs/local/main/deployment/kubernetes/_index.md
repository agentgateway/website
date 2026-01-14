---
title: Deploy on Kubernetes
weight: 25
description: Overview of how to deploy agentgateway on Kubernetes
---

This website, [agentgateway.dev](https://agentgateway.dev/), is primarily focused on deploying and operating agentgateway as a standalone binary.
To deploy agentgateway on Kubernetes, check out the [kgateway](https://kgateway.dev/) project.
Kgateway provides a control plane to dynamically provision and manage agentgateway in Kubernetes environments, with [first-class support](https://kgateway.dev/docs/agentgateway/) for agentgateway.

Kgateway benefits include:
* Native support for [Kubernetes Gateway API](https://gateway-api.sigs.k8s.io/).
* Native support for [Kubernetes Gateway API Inference Extension](https://gateway-api-inference-extension.sigs.k8s.io/).
* [MCP service discovery](https://kgateway.dev/docs/agentgateway/latest/mcp/dynamic-mcp/).
* Dynamic configuration via Kubernetes CRDs.


{{< cards >}}
  {{< card link="https://kgateway.dev/docs/agentgateway/latest/quickstart/" title="Get started with agentgateway on Kubernetes" icon="external-link">}}
{{< /cards >}}