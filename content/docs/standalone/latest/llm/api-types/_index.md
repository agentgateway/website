---
title: API types
weight: 15
description: Supported LLM API endpoint types and route configurations
test: skip
---

Agentgateway supports multiple LLM API endpoint types that determine how clients interact with the gateway and how requests are routed to backends.

The following API types are supported:

- **Chat completions** — The OpenAI `/v1/chat/completions` endpoint. This is the most widely used API type for text generation and chat applications.
- **Realtime** — The OpenAI Realtime API for low-latency, streaming voice and text interactions over WebSockets.
- **Passthrough** — Forwards requests directly to the backend provider without transformation.
