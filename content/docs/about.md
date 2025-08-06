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

{{< callout icon="kgateway" >}}
To use agentgateway in a Kubernetes cluster, check out the [kgateway integration guide](https://kgateway.dev/docs/agentgateway/).
{{< /callout >}}

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

## Policies

Policies are configurable rules that control traffic behavior, security, and transformations for routes and backends.

Based on the [schema](https://github.com/agentgateway/agentgateway/blob/main/schema/local.json), you can configure the following policies. Each policy can be applied individually or in combination, allowing you to tailor security and traffic management to your needs.

* Request Header Modifier: Add, set, or remove HTTP request headers.
* Response Header Modifier: Add, set, or remove HTTP response headers.
* Request Redirect: Redirect incoming requests to a different scheme, authority, path, or status code.
* URL Rewrite: Rewrite the authority or path of requests before forwarding.
* Request Mirror: Mirror a percentage of requests to an additional backend for testing or analysis.
* Direct Response: Return a fixed response (body and status) directly, without forwarding to a backend.
* CORS: Configure Cross-Origin Resource Sharing (CORS) settings for allowed origins, headers, methods, and credentials.
* MCP Authorization: Apply custom authorization rules using the MCP model.
* MCP Authentication: Enforce authentication using an external provider (e.g., Auth0, Keycloak) with issuer, scopes, and audience.
* A2A: Enable agent-to-agent (A2A) communication features.
* AI: Attach AI-specific configuration for routes that use AI backends.
* Backend TLS: Configure TLS settings for secure backend connections, including certificates and trust roots.
* Backend Auth: Set up authentication for backend services (e.g., passthrough, key, GCP, AWS).
* Local Rate Limit: Apply local rate limiting to control request rates.
* Remote Rate Limit: Apply distributed rate limiting using an external service.
* JWT Auth: Enforce JWT authentication with issuer, audiences, and JWKS (key set) configuration.
* External Authorization (extAuthz): Integrate with an external authorization service.
* Timeout: Set request and backend timeouts.
* Retry: Configure retry attempts, backoff, and which response codes should trigger retries.
