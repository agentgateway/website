---
title: Announcing A2A, MCP, and Kubernetes Gateway API support
toc: false
publishDate: 2025-07-14T00:00:00-00:00
author: Christian Posta, John Howard
---

> Today, we're excited to share the next major milestone: agentgateway is now a full-featured, AI-native gateway that combines deep MCP and A2A protocol awareness, robust traffic policy controls, inference gateway support, Kubernetes Gateway API support, and unified access to major LLMs, all purpose-built with Rust for real-world agentic systems.

Back when we first introduced agentgateway, it was designed to fill a critical gap in the AI stack: enabling structured, secure, and scalable communication between agents, tools, and LLMs using protocols like MCP and A2A. [Solo.io wrote about this in a blog post](https://www.solo.io/blog/why-do-we-need-a-new-gateway-for-ai-agents) where we explained why traditional API gateways fall short in agentic environments. Since then, the project has grown tremendously.

Today, we're excited to share the [next major milestone](https://github.com/agentgateway/agentgateway): Agentgateway is now a full-featured, AI-native gateway that combines deep MCP and A2A protocol awareness, robust traffic policy controls, inference gateway support, Kubernetes Gateway API support, and unified access to major LLMs, all purpose-built with Rust for real-world agentic systems.

And notably, agentgateway now fully supports:

* The latest [MCP spec (2025-06-18)](https://modelcontextprotocol.io/), including latest authorization changes
* The v0.2.x release of [A2A](https://github.com/agentgateway/a2a-spec)

Let's take a closer look at the updated capabilities.

## Deep Protocol Awareness: MCP and A2A

Agentgateway continues to deepen its native support for the emerging [Model Context Protocol (MCP)](https://modelcontextprotocol.io/) and [Agent-to-Agent Protocol (A2A)](https://github.com/agentgateway/a2a-spec) with updated support including:

* Protocol-aware routing, telemetry, and tracing
* Support for MCP server/tool aggregation (virtualized MCP servers)
* Updated MCP Authorization support per the June 2025 spec
* Native authorization policy engine using [Cedar](https://www.cedarpolicy.com/) for fine-grained authorizations
* Support for exposing local stdio-based MCP servers as remote targets

Agentgateway can be used to implement authentication and authorization for your MCP servers with minimal set up. We will keep agentgateway updated as these specs continue to evolve.

## Kubernetes Gateway API Support

Agentgateway now implements the [Kubernetes Gateway API](https://gateway-api.sigs.k8s.io/) with support for HTTPRoute, GRPCRoute, TCPRoute, and TLSRoute. This isn't just basic support, we've implemented all core and extended features, and most experimental ones too. This means you can:

* Match traffic based on headers, paths, and query params
* Apply CORS, redirects, header rewrites, request mirroring
* Configure timeouts, retries, and direct responses

For platform teams already using Kubernetes-native tooling, this makes agentgateway a seamless drop-in with advanced L7 control. It's a critical step toward integrating agentic workloads into the broader platform ecosystem.

## Fine-Grained Traffic Policy Controls

In real enterprise deployments, security and reliability aren't optional. That's why agentgateway now includes advanced policy features:

* Local and remote rate limiting
* JWT authentication and external auth, (ie, extAuthz) hooks
* Upstream auth (cloud identity, TLS, etc)
* Full [OpenTelemetry](https://opentelemetry.io/) support for metrics, logs, and distributed tracing

These controls allow you to run production-grade agent infrastructure that meets enterprise security and observability requirements.

## LLM Gateway

Agentgateway can now be used as an "AI Gateway" and route traffic directly to LLMs (OpenAI, Anthropic, Gemini, Bedrock, etc). Top usecases here are unified LLM API, prompt guarding, and resilience (failover, rate limiting, etc).

Agentgateway now provides a unified OpenAI-compatible API across:

* OpenAI / Azure OpenAI
* Anthropic
* Google Gemini
* Amazon Bedrock
* Google Vertex

This enables users to seamlessly move between providers without changes to their application, even dynamically based on the health or performance of a specific provider.

Agentgateway can also be used to implement prompt guarding to scan/filter for sensitive information or full on direct prompt injection attacks:

* Regex-based filters to block prompts with known unsafe patterns
* Optional webhook integration to run pre-flight validation using custom logic

Combined with the fine-grained traffic policy controls, agentgateway can act as a powerful LLM Gateway.

## Inference Routing

If you are running your own models on self-hosted GPU infrastructure, agentgateway now implements the [Inference Gateway](https://github.com/agentgateway/inference-gateway) extensions for more accurate, efficient prompt routing. Using the InferencePool API, you can route based on:

* Prompt criticality
* GPU and KV cache utilization
* Work queue / waiting queue depth
* Lora adapters

This gives AI platform operators more efficient and cost-conscious routing. This can also form the foundation for deeper optimizations like [llm-d](https://github.com/agentgateway/llm-d).

## Get Involved

We're thrilled to see the community interest grow around this project. If you're building agent infrastructure, dealing with LLM routing, or trying to enforce policy in AI-native environments, we'd love your feedback and contributions:

* [Project website](https://agentgateway.io/)
* [GitHub repo](https://github.com/agentgateway/agentgateway)
* [Discord community](https://discord.gg/solo-io)

> Agentgateway has evolved far beyond just a proxy. It's becoming the control point for secure, scalable agentic systems. We're just getting started.