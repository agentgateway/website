---
title: Deploy on Kubernetes
weight: 25
description: Overview of how to deploy agentgateway on Kubernetes
---

This website, [agentgateway.dev](https://agentgateway.dev/), is primarily focused on deploying and operating agentgateway as a standalone binary.

To deploy agentgateway on Kubernetes, agentgateway uses the [kgateway](https://kgateway.dev/) project.
Kgateway provides a control plane to dynamically provision and manage agentgateway in Kubernetes environments, with first-class support for agentgateway.

Kgateway benefits include:
* Native support for [Kubernetes Gateway API](https://gateway-api.sigs.k8s.io/).
* Native support for [Kubernetes Gateway API Inference Extension](https://gateway-api-inference-extension.sigs.k8s.io/).
* [MCP service discovery](https://agentgateway.dev/docs/kubernetes/latest/mcp/dynamic-mcp/).
* Dynamic configuration via Kubernetes CRDs.


{{< cards >}}
  {{< card link="../../../../kubernetes/" title="Get started with agentgateway on Kubernetes" icon="external-link">}}
{{< /cards >}}