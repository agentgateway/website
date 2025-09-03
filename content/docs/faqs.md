---
title: FAQs
weight: 200
description: Check out frequently asked questions about agentgateway. 
--- 

Check out frequently asked questions about agentgateway. 

## What are MCP and A2A? 

{{< reuse "docs/snippets/about-mcp-a2a.md" >}}

## What do MCP and A2A not solve for? 

{{< reuse "docs/snippets/about-mcp-challenges.md" >}}

## What's the problem with traditional API and AI gateways? 

{{< reuse "docs/snippets/about-traditional-gw.md" >}}

## What is agentgateway and why do I want to use it? 

{{< reuse "docs/snippets/about-agw.md" >}}

{{< reuse "docs/snippets/key-benefits.md" >}}

## How does agentgateway relate to kgateway?

While you can manually deploy agentgateway proxies in any environment, you might want a more declarative way to define your agentgateway proxy and deploy it, especially in cloud-native environments, such as Kubernetes. 

The [kgateway open source project](https://kgateway.dev) is the recommended control plane to quickly spin up and manage the lifecycle of agentgateway proxies in Kubernetes clusters. In addition, you can leverage kgateway's traffic management, resiliency, and security policies to further protect your agentgateway proxy and make it more robust. 

Kgateway passes conformance tests for the [Kubernetes Gateway API](https://gateway-api.sigs.k8s.io/) and [Inference Extensions](https://gateway-api-inference-extension.sigs.k8s.io/) projects so you can use the standards that you are familiar with to configure agentgateway. 

For more information about how to deploy agentgateway with kgateway, see the [kgateway documentation](https://kgateway.dev/docs/agentgateway/). 

## What's the difference between agentgateway and kagent? 

Agentgateway governs agent-to-tool, agent-to-agent, and agent-to-LLM communication ensuring that these components can securely and reliably talk to each other and exchange data. However, agentgateway assumes that the MCP servers, tools, and agents that you want to access already exist in your environment.

That’s where [kagent](https://kagent.dev) comes in. With kagent, you can quickly develop, build, and run MCP servers and agents directly in Kubernetes. Kagent automates complex DevOps and platform engineering operations for you with out-of-the-box agents and tools, intelligent workflows, and built-in troubleshooting. 

Together, kagent and agentgateway give you all the tools to successfully build a production-ready agentic AI environment that is scalable, reliable, and secure. 

## What license is agentgateway under?

The agentgateway project uses [Apache License 2.0](https://www.apache.org/licenses/).

## What is the project roadmap?

The agentgateway project organizes issues into milestones for each release. For more details, see the following agentgateway links: 
* [Issues](https://github.com/agentgateway/agentgateway/issues)
* [Milestones](https://github.com/agentgateway/agentgateway/milestones)
* [Project board](https://github.com/orgs/agentgateway/projects/1)

## Where is the changelog? 

The changelog is part of each [GitHub release](https://github.com/agentgateway/agentgateway/releases/).

## What if I have more questions about agentgateway? 

Join the weekly agentgateway [community meeting](https://github.com/agentgateway/agentgateway?tab=readme-ov-file#community-meetings) or engage with the agentgateway community on [Discord](https://discord.com/invite/y9efgEmppm).


