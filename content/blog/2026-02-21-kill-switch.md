---
title: "Multi-Agent Openclaw Architecture with a Kill Switch: Why Every AI Agent Needs a Gateway"
publishDate: 2026-02-21
author: "Sebastian Maniak"
description: "A multi-agent system where a coordinator routes tasks to specialist sub-agents — and every LLM call and MCP tool invocation passes through agentgateway running in Kubernetes for cost control, rate limiting, governance, and a kill switch."
---

## The Setup

I run a multi-agent system. One coordinator agent handles user interaction, memory, and routing. Specialist sub-agents get spawned on demand for domain-specific tasks — security audits, network diagnostics, cloud management, infrastructure automation. Each specialist has its own system prompt, its own toolset, and runs on a different model.

It works. The specialists are good at their jobs. The coordinator knows when to delegate and when to handle things itself.

But here's what keeps me up at night: **what happens when one of these agents goes rogue?**

A security agent with access to nmap and trivy decides to scan every host on the network in a loop. A cloud agent burns through $500 of Opus tokens chasing a hallucinated Terraform state or decides to reconfigure your Istio ambient mesh routing because it misread a waypoint proxy status. A general agent with SSH access starts "fixing" things on production hosts that don't need fixing.

Without a control plane between your agents and the outside world, you have no way to stop any of this. No kill switch. No cost ceiling. No audit trail. No rate limits. Just agents with direct access to LLMs and tools, hoping nothing goes wrong.

That's not engineering. That's negligence.

---

## The Architecture

Here's what I actually run. Every LLM call and every MCP tool invocation from every agent — coordinator and specialists alike — routes through [agentgateway](https://agentgateway.dev).

```
┌─────────────────────────────────────────────────┐
│                   User (Seb)                     │
│          Telegram / Discord / CLI                │
└────────────────────┬────────────────────────────┘
                     │
                     ▼
┌─────────────────────────────────────────────────┐
│              Coordinator Agent                   │
│                  (Jacob)                         │
│                                                  │
│  • User interaction & conversation               │
│  • Memory management (MEMORY.md)                 │
│  • Task triage & routing                         │
│  • Context assembly for specialists              │
│  • Result synthesis & delivery                   │
└──┬──────────┬──────────┬──────────┬─────────────┘
   │          │          │          │
   ▼          ▼          ▼          ▼
┌──────┐  ┌──────┐  ┌──────┐  ┌──────────┐
│ Sec  │  │ Net  │  │Cloud │  │ General  │
│Agent │  │Agent │  │Agent │  │ Agent    │
└──┬───┘  └──┬───┘  └──┬───┘  └────┬─────┘
   │         │         │            │
   └─────────┴─────────┴────────────┘
                  │
                  │  ALL traffic
                  ▼
   ┌──────────────────────────────────────────┐
   │          Kubernetes Cluster              │
   │  ┌──────────────────────────────┐        │
   │  │        agentgateway          │        │
   │  │          (Pod)               │        │
   │  │                              │        │
   │  │  • Kill switch               │        │
   │  │  • Rate limiting             │        │
   │  │  • Cost controls             │        │
   │  │  • JWT auth + RBAC           │        │
   │  │  • Observability (OTel)      │        │
   │  │  • Tool poisoning protection │        │
   │  └──────┬───────────┬───────────┘        │
   │         │           │                    │
   └─────────┼───────────┼────────────────────┘
             │           │
        ┌────▼────┐  ┌───▼────────────────┐
        │  LLMs   │  │    MCP Servers     │
        │Anthropic│  │  nmap, trivy       │
        │ OpenAI  │  │  aws-cli, kubectl  │
        │  xAI    │  │  istioctl, docker  │
        └─────────┘  └───────────────────-┘
```

Nothing reaches an LLM or a tool without passing through the gateway. That's the entire point.

---

## The Agents

### Coordinator: Jacob

The coordinator is the only agent that talks to the user. It owns the conversation, manages memory (a persistent `MEMORY.md` that carries context across sessions), and decides which specialist to invoke for each request.

When a task comes in, the coordinator classifies it and builds a context payload — the relevant portion of memory, the specific question, any constraints — and spawns a specialist. The specialist does its work, returns a result, and dies. Stateless. Disposable.

The coordinator synthesizes the result and delivers it back to the user. If a task spans multiple domains, the coordinator fans out to multiple specialists in parallel.

**Model**: Sonnet — fast enough for routing, smart enough for context assembly.

### Security Agent

- **Domain**: Vulnerability scanning, CVE analysis, firewall rules, IAM audits, compliance checks
- **Tools**: nmap, trivy, falco, OWASP ZAP, CIS benchmarks, secrets scanning
- **Model**: Opus — high reasoning for threat analysis
- **Access**: Read-only on infra by default, escalation required for remediation

### Network Agent

- **Domain**: DNS, routing, load balancing, VPN, firewall config, traffic analysis
- **Tools**: dig, traceroute, tcpdump, iperf3, netstat, ip, iptables, tshark
- **Model**: Sonnet — fast, good for diagnostic tasks
- **Access**: Network interfaces, DNS servers, routing tables

### Cloud Agent

- **Domain**: AWS/GCP/Azure resource management, Terraform, cost optimization, architecture, Kubernetes, Istio service mesh, ambient mesh
- **Tools**: aws-cli, gcloud, az, terraform, kubectl, helm, istioctl
- **Model**: Sonnet — balance of speed and capability
- **Access**: Cloud provider credentials (scoped IAM roles), Kubernetes clusters, Istio control plane

### General / Infra Agent

- **Domain**: Proxmox, Docker, Linux admin, Git, CI/CD, general automation
- **Tools**: ssh, docker, git, systemctl, proxmox API, cron
- **Model**: Sonnet (routine ops) or Haiku (simple tasks)
- **Access**: Full local system, Proxmox API, SSH to hosts

---

## Memory System

OpenClaw Memory System
Persistent recall across sessions using markdown files and vector search.

- Two memory layers — Daily logs (memory/YYYY-MM-DD.md) for running notes, and MEMORY.md for curated long-term facts and preferences.
- Disk-based memory — No RAM between sessions, so everything must be written to disk to be remembered.
- Vector embeddings — Files are chunked and converted to vectors using Qwen3-Embedding-0.6B via node-llama-cpp, fully local and private.
- Hybrid search — Combines vector similarity (semantic) with BM25 full-text search (keyword) for accurate recall.
- Temporal decay — Recent memories are weighted higher in search results.
- memory_search / memory_get — Agent tools to find relevant past context or read a file directly.
- Auto-compaction — When token limits are hit, the agent is prompted to save important context before compacting so nothing is lost.

---

## Routing Logic

The coordinator classifies each request and routes to the appropriate specialist:

| Keywords | Routes To |
|----------|-----------|
| CVE, vulnerability, audit, compliance, secrets | Security Agent |
| DNS, firewall, routing, VPN, latency, ports | Network Agent |
| AWS, Terraform, GCP, Azure, S3, EC2, cost, Istio, mesh, Kubernetes, k8s | Cloud Agent |
| VM, Docker, git, systemd, Proxmox, backup | General Agent |

Ambiguous requests stay with the coordinator. Multi-domain tasks fan out to multiple specialists in parallel.

---

## Why Every Agent Goes Through the Gateway

This is the part that matters. Here's why I don't let any agent — not even the coordinator — talk to LLMs or tools directly.

### The Doom Scenario

Picture this: your cloud agent is debugging a Terraform plan. It calls Opus to reason about a complex state migration. The model hallucinates a resource dependency. The agent re-plans, calls the model again for clarification, gets another hallucination, retries with more context (bigger prompt, more tokens), and enters a loop. Each iteration costs more than the last because the context window keeps growing.

Without a gateway: you find out when the invoice arrives. $2,000 spent on a conversation with itself.

With agentgateway: the agent hits a token-per-minute ceiling after the third iteration. The request is rejected. You get an alert. You investigate. Total damage: $12.

That's not a hypothetical. That's Tuesday.

### Kill Switch

agentgateway gives me a single point where I can shut everything down. If I see an agent misbehaving — through the metrics, through the traces, through an alert — I can:

1. **Revoke the JWT** for that specific agent's identity. Immediate. That agent can't make another LLM call or tool invocation.
2. **Update the rate limit** to zero for that agent class. Every security agent stops. Every cloud agent stops. Surgical.
3. **Pull the gateway entirely.** Nuclear option. Everything stops. Nothing reaches any LLM or tool.

Without a gateway, killing a rogue agent means finding the pod, kubectl exec-ing into the right node, and hoping you're faster than the agent. With a gateway running in Kubernetes, it's a config change — or a `kubectl rollout restart` away from a full reset.

### Cost Controls

Every agent has a budget. Not a suggestion — a hard limit enforced at the gateway level.

```yaml
# Security agent route — Opus workloads
policies:
  localRateLimit:
    - maxTokens: 50000
      tokensPerFill: 50000
      fillInterval: 1m
      type: tokens
    - maxTokens: 20
      tokensPerFill: 20
      fillInterval: 1m
      type: requests

# Cloud agent route — higher throughput
policies:
  localRateLimit:
    - maxTokens: 100000
      tokensPerFill: 100000
      fillInterval: 1m
      type: tokens
    - maxTokens: 30
      tokensPerFill: 30
      fillInterval: 1m
      type: requests

# General agent route — simple ops
policies:
  localRateLimit:
    - maxTokens: 20000
      tokensPerFill: 20000
      fillInterval: 1m
      type: tokens
    - maxTokens: 15
      tokensPerFill: 15
      fillInterval: 1m
      type: requests
```

Each route gets a token-bucket rate limit scoped by the route's identity. The security agent running Opus gets 50k tokens per minute. That's enough for serious threat analysis but not enough to bankrupt me on a hallucination loop. The general agent on Haiku gets 20k — simple ops don't need more.

agentgateway tracks token usage per provider and per model with `agentgateway_gen_ai_client_token_usage` metrics, tagged with provider, model, and operation labels. I know exactly what each agent costs, in real time.

### Rate Limiting

Rate limits aren't just about cost. They're about preventing an agent from overwhelming a downstream system.

A network agent running `nmap` scans through an MCP tool server could, in theory, scan your entire /16 network if nobody stops it. Rate limiting at the gateway means the agent gets N tool calls per minute, period. It can't outrun the limit no matter how convinced it is that it needs to scan "just one more subnet."

Same for LLM calls. An agent that retries on every 429 or timeout — something LLM providers actually rate-limit you for — gets its retries throttled at the gateway before the provider even sees them.

### Governance and RBAC

Each agent has a JWT identity with scoped permissions. The security agent can call `nmap` and `trivy` tools but cannot call `terraform apply`. The cloud agent can call `terraform plan` but not `ssh`. The general agent can SSH to designated hosts but cannot touch cloud credentials.

This is enforced at the gateway with CEL expressions in `mcpAuthorization` rules:

```yaml
# Security agent backend
mcpAuthorization:
  rules:
  - >-
    jwt.agent_role == "security" && (
      mcp.tool.name.startsWith("nmap") ||
      mcp.tool.name.startsWith("trivy") ||
      mcp.tool.name.startsWith("falco")
    )

# Cloud agent backend
mcpAuthorization:
  rules:
  - >-
    jwt.agent_role == "cloud" && (
      mcp.tool.name.startsWith("terraform") ||
      mcp.tool.name.startsWith("kubectl") ||
      mcp.tool.name.startsWith("istioctl") ||
      mcp.tool.name.startsWith("helm")
    )
```

Even if a specialist agent's system prompt gets jailbroken and it tries to invoke tools outside its domain, the gateway blocks it. If a tool isn't matched by a rule, it's automatically filtered from the `tools/list` response — the agent literally cannot see tools it doesn't have access to.

And since unmatched tools are denied by default, I only whitelist what's explicitly allowed. Any tool not covered by an `mcpAuthorization` rule is invisible to the agent. For HTTP-level operations, I add explicit deny rules:

```yaml
authorization:
  rules:
  - deny: 'request.path.contains("delete")'
  - deny: 'request.path.contains("destroy")'
  - deny: 'request.path.contains("drop")'
```

No agent gets to run destructive operations without explicit human escalation. Period.

### Full Observability

Every LLM call and every tool invocation generates OpenTelemetry traces. Every trace is tagged with the agent identity that triggered it.

I can see:

- **Which agent** made the call
- **What prompt** was sent to the LLM
- **What tool** was invoked with what arguments
- **How many tokens** were consumed
- **How long** it took
- **Whether it succeeded** or failed

```
┌─ Trace: security-agent-cve-scan ──────────────────┐
│                                                     │
│  initialize          12ms   mcp-session-setup       │
│  list_tools          8ms    tool-discovery          │
│  call_tool(nmap)     4.2s   scan-target-host        │
│  llm_call(opus)      3.1s   analyze-scan-results    │
│  call_tool(trivy)    6.8s   container-vuln-scan     │
│  llm_call(opus)      2.4s   synthesize-findings     │
│                                                     │
│  Total: 16.5s | Tokens: 12,847 | Cost: $0.38       │
└─────────────────────────────────────────────────────┘
```

Metrics go to Prometheus. Traces go to Jaeger. LLM-specific telemetry goes to Langfuse for prompt/completion pair analysis. All of it through agentgateway's built-in OpenTelemetry support — no instrumentation code in the agents themselves.

When something goes wrong, I don't grep through logs hoping to find what happened. I open a dashboard and see exactly which agent, which call, which tool, at what time, with what parameters.

---

## Design Decisions

**Specialists are stateless, spawned per task.** Simple and cost-effective. No long-running agent processes consuming resources while idle. The coordinator is the only persistent component.

**Coordinator owns all memory.** Specialists get context injected per request. They don't need to remember previous conversations — the coordinator handles continuity.

**Model per agent.** Opus for security (high-stakes reasoning). Sonnet for network/cloud (speed + capability balance). Haiku for simple ops (cost efficiency). Each agent gets the cheapest model that's good enough for its domain.

**Tool isolation.** Each specialist only gets the tools it needs. Not through prompt instructions (which can be jailbroken) but through gateway-enforced RBAC (which can't).

**Single gateway for all traffic.** Not one gateway per agent. Not a sidecar pattern. One agentgateway instance running in Kubernetes that every agent routes through. One place to set policy, one place to monitor, one place to kill. K8s gives me rolling updates, health checks, and resource limits on the gateway itself — so the control plane has its own control plane.

**Extensible.** New domain = new agent config + system prompt + tool set. The coordinator's routing logic gets a new keyword match. The gateway gets a new JWT scope. No architectural changes needed.

---

## Running agentgateway in Kubernetes

agentgateway runs as a deployment in my Kubernetes cluster. This isn't just convenience — it's operational discipline. The gateway that controls all my agents is itself managed by K8s primitives: health checks, resource limits, rolling updates, and restart policies.

The kill switch becomes even simpler in K8s. Scale to zero replicas and every agent loses its gateway instantly:

```bash
kubectl scale deployment agentgateway -n agent-infra --replicas=0
```

Everything stops. Scale back up when you've fixed the issue. The gateway comes back with the same config, same policies, same state.

The cloud agent — the one that handles Kubernetes, Istio, and ambient mesh — is particularly interesting in this setup. It manages the same cluster that hosts the gateway. That's a circular dependency I've thought carefully about: the agent that manages K8s infrastructure talks through a gateway that runs on K8s infrastructure. The circuit breaker here is the RBAC policy — the cloud agent's JWT scope explicitly excludes the `agent-infra` namespace. It can manage workloads, configure Istio routing, and deploy ambient mesh policies, but it cannot touch the gateway deployment itself.

---

## Why agentgateway and Not a Traditional Proxy

Traditional API gateways (Envoy, Kong, NGINX) were built for HTTP request/response. AI agent traffic is fundamentally different:

- **MCP is stateful.** Agents maintain long-lived sessions with tool servers. Requests and responses are tied to session context. Traditional gateways don't maintain session awareness.
- **LLM calls are long-running.** A single inference call can take 30+ seconds with streaming. Connection timeouts designed for web APIs don't apply.
- **Token-based economics.** Cost isn't about request count — it's about token count. A gateway that can't count tokens can't enforce budgets.
- **Bidirectional communication.** MCP servers can push messages back to clients asynchronously. This breaks the request/response model traditional gateways assume.

[agentgateway](https://agentgateway.dev) is purpose-built for this. Written in Rust for performance and memory safety on stateful, long-lived connections. Understands MCP sessions natively. Counts tokens per-provider. Handles fan-out patterns where one agent call becomes multiple downstream requests.

It's open source, Apache 2.0 licensed, and part of the Linux Foundation. No vendor lock-in.

---

## The Takeaway

A multi-agent system without a control plane is a liability. Every agent you deploy is a potential cost bomb, a potential security breach, a potential "I can't believe nobody caught that" incident.

The architecture is straightforward:

1. **One coordinator** that handles users and routes tasks
2. **Specialist agents** that are stateless, scoped, and disposable
3. **One gateway** that sees everything, controls everything, and logs everything

The coordinator decides *what* gets done. The gateway decides *whether* it's allowed to happen. That separation is what makes the system safe to run autonomously.

agentgateway isn't optional in this architecture. It's the thing that makes the entire system possible without me staring at a terminal 24/7 wondering if an agent is about to do something catastrophic.

Build the agents. Put the gateway in front. Sleep at night.

**Resources:**
- [agentgateway](https://agentgateway.dev)
- [agentgateway GitHub](https://github.com/agentgateway/agentgateway)
- [agentgateway Docs — MCP](https://agentgateway.dev/docs/standalone/latest/about/introduction/)
- [agentgateway Telemetry & Observability](https://agentgateway.dev/docs/standalone/latest/tutorials/telemetry/)
