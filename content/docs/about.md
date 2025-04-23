---
title: About
weight: 20
description:
---

Agent Gateway is an open source, highly available, highly scalable, and enterprise-grade data plane that provides AI connectivity for agents and tools in any environment. 

## Why Agent Gateway?

With Agentic AI changing the way organizations build and deliver applications, organizations face the challenge of rapidly adopting new technologies and interoperability protocols to connect agents and tools in fragmented environments. To accelerate agent development, infrastructure is needed that transcends the rapidly changing landscape.  

Agent Gateway provides a unified data plane to manage agent connectivity with support for agent protocols, such as Model Context Protocol (MCP) and agent-to-agent (A2A), and the ability to integrate existing REST APIs as agent-native tools. A built-in self-service developer portal allows agent developers to easily connect, discover, federate, integrate, and secure agents and tools in any environment, including bare metal, VMs, containers, and Kubernetes. 

Agent Gateway also comes with built-in security and observability features that allow you to secure the connection to the proxy, manage acess to tools and agents, and monitor traffic that goes through the Agent Gateway. 

## Architecture

The following figure shows how Agent Gateway provides AI connectivity for agents and tools in any environment.

{{< reuse-image src="img/architecture.svg" caption="Figure: Agent Gateway works across compute environments to provide connectivity to various agentic tools, including MCP servers, agents, and OpenAPI endpoints." >}}


## Key features

Agent Gateway comes with the following key features: 

* **Open source**: Agent Gateway is open source, and licensed under the Apache 2.0 license. 
* **Compatible with any agentic framework**: Agent Gateway is compatible with any agentic framework supporting the Model Context Protocol (MCP) or agent-to-agent (A2A) protocol, including LangGraph, AutoGen, kagent, Claude Desktop, and OpenAI SDK. You can also use Agent Gateway to expose a REST API as an agent-native tool. 
* **Platform-agnostic**: Agent Gateway can run in any environment, including bare metal, virtual machine, containers, and Kubernetes. 
* **Highly performant**: Agent Gateway is written in Rust and designed to handle any scale. 
* **Tool federation**: Agent Gateway can connect to multiple targets and provide a unified view of the tools and agents that are exposed on these targets. 
* **Dynamic configuration updates**: Agent Gateway can be updated via an xDS interface without any downtime. 
* **Security with RBAC**: Agent Gateway supports a robust RBAC system that allows you to control access to MCP tools and agents. 
* **Built-in observability**: Agent Gateway comes with built-in metrics and tracing capabilities that allow you to monitor the traffic that goes through the Agent Gateway.

