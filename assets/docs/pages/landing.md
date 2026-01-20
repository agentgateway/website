{{< reuse "docs/snippets/about-agw.md" >}}

{{< callout type="info" >}}
**New to agentgateway?** Get started in minutes with the [Quickstart guide]({{< link-hextra path="/quickstart/" >}})!
{{< /callout >}}

{{< reuse-image src="img/architecture.svg" caption="Figure: agentgateway works across compute environments to provide connectivity to various agentic tools, including MCP servers, agents, and OpenAPI endpoints." >}}

## Why agentgateway?

Traditional API gateways and reverse proxies aren't built for MCP and A2A, and adapting them isn't straightforward. These systems are optimized for **stateless REST-style interactions**—one request in, pick a backend, one response out—with no session context or ongoing connection state.

MCP and A2A are fundamentally different:

| Traditional API Gateway | Agentgateway |
|------------------------|--------------|
| Stateless request/response | **Stateful JSON-RPC sessions** with long-lived connections |
| One request → one backend | **Session fan-out** across multiple MCP servers |
| Client-initiated only | **Bidirectional**: servers can push events (SSE) to clients |
| Simple routing by path/header | **Protocol-aware routing** that understands JSON-RPC message bodies |
| Static backend mapping | **Dynamic tool virtualization** on a per-client basis |

### Challenges traditional gateways can't solve

- **Multiplexing & fan-out**: A single client request like "list available tools" needs to fan out across multiple backend MCP servers, aggregate responses, and return a unified result.
- **Server-initiated events**: MCP servers can push real-time updates via Server-Sent Events (SSE) that must be properly routed back through the client session.
- **Protocol negotiation**: Graceful handling of protocol upgrades and fallbacks as MCP/A2A specs evolve.
- **Per-session authorization**: Different clients may have access to different tools, requiring dynamic adjustment of what gets exposed.
- **Tool poisoning protection**: Defense against direct tampering, shadowing, and rug-pull attacks on tools.

### Built for performance

Agentgateway is built in **Rust** because performance and memory safety are non-negotiable for stateful, long-lived connections and fan-out patterns. Every millisecond and megabyte counts when managing concurrent sessions across multiple backend servers.

## Features

Agentgateway is a unified data plane for managing agent connectivity, built in Rust for high performance and reliability. It supports agent protocols including MCP and A2A, and provides a unified interface for LLM consumption.

### LLM Gateway

Route traffic to major LLM providers through a **unified OpenAI-compatible API**. Seamlessly switch between providers without changing your application code.

| Provider | Chat Completions | Streaming |
|----------|:----------------:|:---------:|
| OpenAI / Azure OpenAI | ✅ | ✅ |
| Anthropic | ✅ | ✅ |
| Google Gemini | ✅ | ✅ |
| Google Vertex AI | ✅ | ✅ |
| Amazon Bedrock | ✅ | ✅ |

#### OpenAI-compatible providers

Don't see your provider? Many LLMs expose OpenAI-compatible APIs. Agentgateway can route to **any provider** that supports the OpenAI API format, including:

- **Cohere**, **Mistral**, **Groq**, **Together AI**, **Fireworks**
- **Ollama**, **LM Studio**, **vLLM**, **llama.cpp** (local models)
- Any custom or self-hosted endpoint with OpenAI-compatible `/v1/chat/completions`

#### Self-hosted models & Inference routing

Running your own models on GPU infrastructure? Agentgateway implements the [Kubernetes Inference Gateway](https://gateway-api-inference-extension.sigs.k8s.io/) extensions for intelligent routing to local LLM workloads. Route based on:

- **GPU & KV cache utilization** — Send requests to the least-loaded model
- **Prompt criticality** — Prioritize high-priority requests
- **LoRA adapters** — Route to models with specific fine-tuned adapters
- **Work queue depth** — Avoid overloaded inference servers

### MCP Gateway

Connect LLMs to tools and external data sources using the [Model Context Protocol (MCP)](https://modelcontextprotocol.io/). Agentgateway provides:

- **Tool federation**: Aggregate multiple MCP servers behind a single endpoint
- **Protocol support**: stdio, HTTP/SSE, and Streamable HTTP transports
- **OpenAPI integration**: Expose existing REST APIs as MCP-native tools
- **Authentication & authorization**: Built-in MCP auth spec compliance with OAuth providers (Auth0, Keycloak)

### A2A Gateway

Enable secure communication between AI agents using the [Agent-to-Agent (A2A)](https://github.com/a2aproject/A2A) protocol. Agents can:

- Discover each other's capabilities
- Negotiate interaction modalities (text, forms, media)
- Collaborate on long-running tasks
- Operate without exposing internal state or tools

### Security & Observability

- **Authentication**: JWT, API keys, basic auth, MCP auth spec
- **Authorization**: Fine-grained RBAC with [Cedar policy engine](https://www.cedarpolicy.com/)
- **Traffic policies**: Rate limiting, CORS, TLS, external authz
- **Observability**: Built-in [OpenTelemetry](https://opentelemetry.io/) metrics, logs, and distributed tracing

### Platform Agnostic

Run agentgateway anywhere—bare metal, VMs, containers, or Kubernetes. Conformant to the [Kubernetes Gateway API](https://gateway-api.sigs.k8s.io/) with support for HTTPRoute, GRPCRoute, TCPRoute, and TLSRoute.

## Next steps

{{< conditional-text include-if="local" >}}
{{< cards >}}
  {{< card link="quickstart" title="Quickstart" >}}
  {{< card link="about" title="About" >}}
  {{< card link="deployment" title="Deployment" >}}
  {{< card link="configuration" title="Configuration" >}}
  {{< card link="tutorials" title="Tutorials" >}}
  {{< card link="llm" title="LLM consumption" >}}
  {{< card link="inference" title="Inference routing" >}}
  {{< card link="mcp" title="MCP connectivity" >}}
  {{< card link="agent" title="Agent connectivity" >}}
  {{< card link="integrations" title="Integrations" >}}
  {{< card link="reference" title="Reference" >}}
  {{< card link="faqs" title="FAQs" >}}
{{< /cards >}}
{{< /conditional-text >}}

{{< conditional-text include-if="kubernetes" >}}
{{< cards >}}
  {{< card link="quickstart" title="Get started" >}}
  {{< card link="about" title="About" >}}
  {{< card link="install" title="Installation" >}}
  {{< card link="setup" title="Gateway setup" >}}
  {{< card link="llm" title="LLM consumption" >}}
  {{< card link="inference" title="Inference routing" >}}
  {{< card link="mcp" title="MCP connectivity" >}}
  {{< card link="agent" title="Agent connectivity" >}}
  {{< card link="traffic-management" title="Traffic management" >}}
  {{< card link="security" title="Security" >}}
  {{< card link="configuration" title="Configuration" >}}
  {{< card link="observability" title="Observability" >}}
  {{< card link="operations" title="Operations" >}}
  {{< card link="reference" title="Reference" >}}
{{< /cards >}}
{{< /conditional-text >}}
