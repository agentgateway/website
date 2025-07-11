---
title: About
weight: 20
description:
---

Agentgateway is an open source, highly available, highly scalable, and enterprise-grade data plane that provides AI connectivity for agents and tools in any environment. 

## Why agentgateway?

With Agentic AI changing the way organizations build and deliver applications, organizations face the challenge of rapidly adopting new technologies and interoperability protocols to connect agents and tools in fragmented environments. To accelerate agent development, infrastructure is needed that transcends the rapidly changing landscape.  

Agentgateway provides a unified data plane to manage agent connectivity with support for agent protocols, such as Model Context Protocol (MCP) and agent-to-agent (A2A), and the ability to integrate existing REST APIs as agent-native tools. A built-in self-service developer portal allows agent developers to easily connect, discover, federate, integrate, and secure agents and tools in any environment, including bare metal, VMs, containers, and Kubernetes. 

Agentgateway also comes with built-in security and observability features that allow you to secure the connection to the proxy, manage acess to tools and agents, and monitor traffic that goes through the agentgateway. 

## Architecture

The following figure shows how agentgateway provides AI connectivity for agents and tools in any environment.

{{< reuse-image src="img/architecture.svg" caption="Figure: agentgateway works across compute environments to provide connectivity to various agentic tools, including MCP servers, agents, and OpenAPI endpoints." >}}


## Key features

Agentgateway comes with the following key features: 

* **Open source**: Agentgateway is open source, and licensed under the Apache 2.0 license. 
* **Compatible with any agentic framework**: Agentgateway is compatible with any agentic framework supporting the Model Context Protocol (MCP) or agent-to-agent (A2A) protocol, including LangGraph, AutoGen, kagent, Claude Desktop, and OpenAI SDK. You can also use agentgateway to expose a REST API as an agent-native tool. 
* **Platform-agnostic**: Agentgateway can run in any environment, including bare metal, virtual machine, containers, and Kubernetes. 
* **Conformant to the Gateway API project**: Agentgateway is conformant to the [Kubernetes Gateway API project](https://gateway-api.sigs.k8s.io/implementations/#agent-gateway-with-kgateway), which allows you to use it as a gateway with any Gateway API implementation.
* **Highly performant**: Agentgateway is written in Rust and designed to handle any scale. 
* **Tool federation**: Agentgateway can connect to multiple targets and provide a unified view of the tools and agents that are exposed on these targets. 
* **Dynamic configuration updates**: Agentgateway can be updated via an xDS interface without any downtime. 
* **Security with RBAC**: Agentgateway supports a robust RBAC system that allows you to control access to MCP tools and agents. 
* **Built-in observability**: Agentgateway comes with built-in metrics and tracing capabilities that allow you to monitor the traffic that goes through the agentgateway.
