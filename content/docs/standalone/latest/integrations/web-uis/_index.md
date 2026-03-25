---
title: Web UIs & agent frameworks
weight: 1
description: Integrate agentgateway with popular web interfaces and agent frameworks for enterprise governance
---

Agentgateway provides a unified control plane to secure, observe, and audit all AI communications from web UIs and agent frameworks. By routing LLM, A2A, and MCP traffic through agentgateway, enterprises gain complete visibility and governance over their AI infrastructure.

{{< callout type="info" >}}
Looking for a UI to review your agentgateway resources such as routes and policies? Check out the [agentgateway Admin UI]({{< link-hextra path="/operations/ui/" >}}) guide.

On this page, you learn about connecting other AI web UI tools to agentgateway instead of directly to the backing LLM providers.
{{< /callout >}}

## Why Use agentgateway with Web UIs?

Web UIs and agent frameworks typically connect directly to LLM providers and tool servers, creating blind spots for security and compliance teams. Agentgateway sits between these interfaces and your AI backends to provide the following.

- **Centralized Authentication** - Enforce consistent auth policies across all AI interfaces
- **Access Control** - Fine-grained RBAC for models, tools, and agent capabilities
- **Audit Logging** - Complete trace of all LLM prompts, tool calls, and agent interactions
- **Rate Limiting** - Prevent runaway costs and resource exhaustion
- **Content Filtering** - Block sensitive data from leaving your environment
- **Observability** - Metrics, traces, and dashboards for all AI traffic

## Supported Integrations

{{< cards >}}
  {{< card link="open-webui" title="Open WebUI" subtitle="Self-hosted ChatGPT-like interface" >}}
  {{< card link="goose" title="Goose" subtitle="Block's autonomous AI agent" >}}
  {{< card link="kagent" title="Kagent" subtitle="Kubernetes-native AI agent framework" >}}
  {{< card link="librechat" title="LibreChat" subtitle="Open source multi-model chat UI" >}}
  {{< card link="chatbot-ui" title="Chatbot UI" subtitle="Open source ChatGPT interface" >}}
{{< /cards >}}
