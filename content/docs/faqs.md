---
title: FAQs
weight: 100
description: Check out frequently asked questions about agentgateway. 
--- 

Check out frequently asked questions about agentgateway. 

## What are MCP and A2A? 

With Agentic AI changing the way organizations build and deliver applications, organizations face the challenge of rapidly adopting new technologies and interoperability protocols to connect agents and tools in fragmented environments. To accelerate agent development, infrastructure is needed that transcends the rapidly changing landscape.

[Model Context Protocol (MCP)](https://modelcontextprotocol.io/docs/getting-started/intro) has become the de facto standard to retrieve and exchange context with Large Language Models (LLMs) and for connecting LLMs to tools. [Agent-to-Agent (A2A)](https://github.com/a2aproject/A2A) is a newly introduced complementary protocol to MCP that solves for long-running tasks and state management across multiple agents. MCP and A2A are both JSON-RPC protocols that define the structure of how an agent describes what it wants to do, how it calls tools, and how it hands off tasks to other agents.

While MCP and A2A define the RPC communication protocol for agents and tools, they currently do not address enterprise-level concerns regarding authentication, authorization, resiliency, tracing, tenancy, and guardrails. In addition, LLMs, agents, and tools are typically spread across remote networks, which requires low latency and handling of retries, timeouts, and failures. 

## What's the problem with traditional API and AI gateways? 

Traditional API gateways, reverse proxies and AI gateways, such as Envoy, were built and optimized for RESTful microservices architectures where the gateway receives short-lived HTTP requests from a client, decides on a backend, and forwards the request to that backend. Typically, no session context or ongoing connection state is required in these cases. 

MCP, by contrast, is a stateful protocol based on JSON-RPC with its own semantics for how to retrieve and exchange context with LLMs. MCP clients and servers must maintain long-lived sessions where requests and responses are sent constantly. Every request and response must be tied to the same session context. In addition, MCP servers can initiate messages back to the client asynchronously, which makes keeping track of all stateful sessions challenging. 

A single client request, such as to list all available tools, might require the proxy to access multiple backend MCP servers, aggregate the responses, and return a single coherent result. In addition, clients might not have access to all the tools that are available on the server. The proxy must be capable to dynamically adjust its responses on a per-session basis and map each client session to the backend servers it is allowed to access. 

Traditional gateways are not built with the session and message awareness that is required to properly handle stateful, session-based, and bidirectional communications. In addition, these communication patterns are very resource intensive and can quicky overwhelm traditional gateways leading to performance impacts or even failure. 

## What is agentgateway and why do I want to use it? 

Agentgateway provides secure, scalable, stateful, bidirectional communication for MCP servers and AI agents in any environment. It is built to solve the common challenges with traditional gateway proxies and missing specification in the MCP and A2A protocols by providing enterprise-grade security, observabiity, resiliency, reliability, and multi-tenancy. 

* **Unified data plane**: Agentgateway is a unified data plane to manage agent connectivity with support for agent protocols, such as Model Context Protocol (MCP) and agent-to-agent (A2A), and the ability to integrate existing REST APIs as agent-native tools. 
* **Highly performant**: Built in Rust, agentgateway is designed to handle any scale. It is optimized for high throughput, low latency, reliability, and stability when handling long-lived connections and fan-out patterns. 
* **Any agent framework**: Agentgateway is compatible with any agentic framework supporting the Model Context Protocol (MCP) or agent-to-agent (A2A) protocol, including LangGraph, AutoGen, kagent, Claude Desktop, and OpenAI SDK. You can also use agentgateway to expose a REST API as an agent-native tool.
* **Platform-agnostic**: Agentgateway can run in any environment, including bare metal, virtual machine, containers, and Kubernetes.
* **Multiplexing and tool federation**: Agentgateway provides a single endpoint to federate multiple backend MCP servers and virtualize tool servers on a per-client basis.
* **Automatic protocol upgrades/fallbacks**: Agentgateway is built to negotiate and gracefully handle protocol upgrades and fallbacks to avoid client or server failures as the MCP/A2A protocols evolve.
* **Authentication and authorization**: Built-in JWT authentication and a robust RBAC system allow you to control access to MCP servers, tools and agents, and to protect against [tool poisoning attacks](https://invariantlabs.ai/blog/mcp-security-notification-tool-poisoning-attacks). 
* **Built-in observability**: Agentgateway comes with built-in metrics and tracing capabilities that allow you to monitor the MCP client and backend tool interactions.
* **Self-service portal**: Agentgateway provides a built-in self-service developer portal that allows agent developers to easily connect, discover, federate, integrate, and secure agents and tools in any environment, including bare metal, VMs, containers, and Kubernetes.
* **Open source**: Agentgateway is open source, and licensed under the Apache 2.0 license.
* **Conformant to the Gateway API project**: Agentgateway is conformant to the Kubernetes Gateway API project, which allows you to use it as a gateway with any Gateway API implementation.
* **Dynamic configuration updates**: Agentgateway can be updated via an xDS interface without any downtime.

## How does agentgateway relate to kgateway?

While you can manually deploy agentgateway proxies in any environment, you might want a more declarative way to define your agentgateway proxy and deploy it, especially in cloud-native environments, such as Kubernetes. 

The [kgateway open source project](kgateway.dev) is the recommended control plane to quickly spin up and manage the lifecycle of agentgateway proxies in a Kubernetes clusters. In addition, you can leverage kgateway's traffic management, resiliency, and security policies to further protect your agentgateway proxy and make it more robust. 

For more information about how to deploy agentgateway with kgateway, see the [kgateway documentation](https://kgateway.dev/docs/agentgateway/). 

## What's the difference between agentgateway and kagent? 

Agentgateway provides secure, scalable, stateful, bidirectional connectivity between clients, MCP servers, tools, and agents. However, agentgateway assumes that the MCP servers, tools, and agents already exist in an environment so that it can connect to them. 

To develop, build, and run MCP servers and agents in Kubernetes, you can use the open source project [Kagent](kagent.dev) instead. Kagent automates complex DevOps and platform engineer operations for you with intelligent workflows and built-in troubleshooting. 


## What license is agentgateway under?

The kgateway project uses [Apache License 2.0](https://www.apache.org/licenses/).

## What is the project roadmap?

The agentgateway project organizes issues into milestones for each release. For more details, see the following agentgateway links: 
* [Issues](https://github.com/agentgateway/agentgateway/issues)
* [Milestones](https://github.com/agentgateway/agentgateway/milestones)
* [Project board](https://github.com/orgs/agentgateway/projects/1)

## Where is the changelog? 

The changelog is part of each [GitHub release](https://github.com/agentgateway/agentgateway/releases/).


