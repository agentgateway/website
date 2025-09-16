---
title: Deploy on Kubernetes
weight: 20
description: Overview of how to deploy agentgateway on Kubernetes
---

This website, [agentgateway.dev](agentgateway.dev), is primarily focused on deploying and operating agentgateway as a standalone binary.
For deployment on Kubernetes, it is recommend to be deployed with [Kgateway](https://kgateway.dev/).
Kgateway provides a control plane to dynamically provision and manage agentgateway in Kubernetes environments, with [first-class support](https://kgateway.dev/docs/main/agentgateway/) for agentgateway.

Kgateway benefits include:
* Native support for [Kubernetes Gateway API](https://gateway-api.sigs.k8s.io/).
* Native support for [Kubernetes Gateway API Inference Extension](https://gateway-api-inference-extension.sigs.k8s.io/).
* [MCP service discovery](https://kgateway.dev/docs/main/agentgateway/mcp/dynamic-mcp/).
* Dynamic configuration via Kubernetes CRDs.
