---
title: "agentgateway Joins AAIF as an Open Gateway for Agentic AI Infrastructure"
publishDate: 2026-06-04
author: "Agentic AI Foundation"
category: "Announcement"
description: "agentgateway joins the Agentic AI Foundation as the fourth hosted initiative under the Linux Foundation — an open, high-performance gateway for MCP, A2A, LLM inference, and conventional API traffic."
toc: false
---

> _Originally published by the [Agentic AI Foundation](https://aaif.io/blog/agentgateway-joins-aaif-as-an-open-gateway-for-agentic-ai-infrastructure/)._

AI systems increasingly resemble distributed systems. Agents invoke tools, models route across providers, and workflows span APIs, MCP servers, databases, and other agents. As these systems move from prototypes to production, organizations are finding that infrastructure designed for traditional web traffic lacks the governance, observability, routing, and security controls that agentic systems demand.

agentgateway addresses this gap. The project has joined the [Agentic AI Foundation](https://aaif.io/) as the fourth hosted initiative under the Linux Foundation.

### Overview

agentgateway is an open source gateway engineered for modern AI system architectures. It delivers a unified management layer for MCP traffic, Agent-to-Agent communication, LLM inference, REST APIs, and gRPC services through a consolidated operational interface.

Rather than deploying separate infrastructure for AI workloads, organizations leverage agentgateway to manage AI and conventional application traffic using identical security controls, observability systems, routing policies, and governance frameworks.

### Key Capabilities

- **MCP and A2A support** — routing and federation for agent interoperability protocols
- **Model independence** — seamless LLM provider switching with open-weights model flexibility
- **Unified data plane** — single gateway for HTTP, gRPC, LLM inference, and agent workloads
- **Security controls** — JWT authentication, API key validation, RBAC, external authorization, mTLS, CORS, and malicious tool protections
- **Built-in observability** — metrics, tracing, and access logs for AI workflows
- **MCP virtualization** — consolidate multiple MCP tool servers with tool-level access policies
- **Declarative policy via CEL** — dynamic configuration using Common Expression Language
- **Governance features** — rate limiting, content-based routing, prompt guards, and budget controls
- **Platform-agnostic deployment** — bare metal, VMs, containers, and Kubernetes
- **Dynamic configuration** — xDS-based updates without service interruption
- **High-performance design** — Rust implementation for low-latency operations

### Ecosystem Impact

AAIF provides neutral governance for agentic AI standards, protocols, and open source initiatives. agentgateway strengthens this ecosystem by establishing shared infrastructure for AI traffic, agent workflows, interoperability, security, and governance.

David Soria Parra, AAIF Technical Committee Chair, emphasized: "agentgateway helps fill that gap with an open, high-performance platform designed specifically for these emerging workloads."

Lin Sun, Solo.io Head of Open Source and agentgateway contributor, noted the initiative reflects "open connectivity and interoperability" principles with "open collaboration and neutral governance."

The project operates under Apache 2.0 licensing, with 300+ active contributors across 60+ organizations including CoreWeave, Red Hat, Solo.io, Adobe, Salesforce, Amdocs, and Microsoft.

### Getting Started

- **Documentation:** [agentgateway.dev](https://agentgateway.dev/)
- **Code:** [GitHub repository](https://github.com/agentgateway/agentgateway)
- **Getting Started Guide:** Available on the [official site](https://agentgateway.dev/docs/)
- **Community:** [Discord channel](https://discord.gg/BfB6DUCkYr)
- **Meetings:** Weekly community gatherings (details in the repository README)
