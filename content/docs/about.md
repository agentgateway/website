---
title: About
weight: 20
description:
---

Agentproxy is an open source, highly available, highly scalable, and enterprise-grade Agent Gateway that provides AI connectivity for agents and tools in any environment. 

## Why agentproxy?

With Agentic AI changing the way organizations build and deliver applications, organizations face the challenge of rapidly adopting new technologies and interoperability protocols to connect agents and tools in fragmented environments. To accelerate agent development, infrastructure is needed that transcends the rapidly changing landscape.  

Agentproxy provides a unified data plane to manage agent connectivity with support for agent protocols, such as Model Context Protocol (MCP) and agent-to-agent (A2A), and the ability to integrate existing REST APIs as agent-native tools. A built-in self-service developer portal allows agent developers to easily connect, discover, federate, integrate, and secure agents and tools in any environment, including bare metal, VMs, containers, and Kubernetes. 

Agentproxy also comes with built-in security and observability features that allow you to secure the connection to the proxy, manage acess to tools and agents, and monitor traffic that goes through the agentproxy. 

## Architecture

The following figure shows how agentproxy provides AI connectivity for agents and tools in any environment.

{{< reuse-image src="img/architecture.svg" caption="Figure: Agentproxy works across compute environments to provide connectivity to various agentic tools, including MCP servers, agents, and OpenAPI endpoints." >}}


## Key features

Agentproxy comes with the following key features: 

* **Open source**: Agentproxy is open source, and licensed under the Apache 2.0 license. 
* **Compatible with any agentic framework**: Agentproxy is compatible with any agentic framework supporting Model Context Protocol (MCP) or agent-to-agent (A2A) protocol, including LangGraph, AutoGen, kagent, Claude Desktop, and OpenAI SDK. You can also use agentproxy to expose a REST API as an agent-native tool. 
* **Platform-agnostic**: Agentproxy can run in any environment, including bare metal, virtual machine, containers, and Kubernetes. 
* **Highly performant**: Agentproxy is written in Rust and designed to handle any scale. 
* **Tool federation**: Agentproxy provides a unifie
* **Dynamic configuration updates**: Agentproxy can be updated via an xDS interface without any downtime. 
* **Security with RBAC**: Agentproxy supports a robust RBAC system that allows you to control access to MCP tools and agents. 
* **Built-in observability**: Agentproxy comes with built-in metrics and tracing capabilities that allow you to monitor the traffic that goes through the agentproxy.

