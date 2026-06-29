---
title: "MCP Guardrails with AARM and Microsoft Agent Governance Toolkit"
category: "Integration"
publishDate: 2026-06-29
author: "Christian Posta"
description: "AI agents behavior emerge at runtime. Roles and pre-defined access is not enough"
toc: false
---

{{< reuse-image src="img/blog/aarm-agt-guardrails/flow-architecture.png"  >}}

Agentgateway can call out to policy engines for LLM guardrail or for enterprise policy decisions. We've recently added support for MCP guardrails. This blog goes a layer deeper and shows where MCP guardrails would fit into an agentic architecture following the principals from the [AARM paper](https://arxiv.org/html/2602.09433v1).

---
TL;DR

I have put together a demo that digs into the AGT framework with agentgateway.

You can find it here: [https://github.com/christian-posta/agent-governance-agw](https://github.com/christian-posta/agent-governance-agw)

<iframe width="560" height="315" src="https://www.youtube.com/embed/NCZhGs5QfNk" title="YouTube video player" frameborder="0" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share" referrerpolicy="strict-origin-when-cross-origin" allowfullscreen></iframe>

---

AI agents [are not like microservices](https://blog.christianposta.com/difference-between-microservices-and-ai-agents/). An agent's intent is "interpreted" and explores its way to a solution for a goal. When agentgateway sits on the request path to other agents, MCP tools, or APIs as a policy enforcement point (PEP), we are one step closer to coralling this emergent behavior with policy and guardrails.

Typical policy decision systems ([think things like OPA](https://www.openpolicyagent.org)) are good at evaluating a number of signals and making policy decisions. Think "attribute based access control". They are stateless, take some "context" to evaluate (subject, roles, the resource being accessed, the action being taken) and return a deterministic allow/deny decision.

For traditional API calls, this works brilliantly. The context is predictable and discrete: user A with role B is trying to invoke operation C on resource D. Write the Rego rule, ship the policy, done.

But AI agents break this model. The same MCP tool call can be entirely legitimate in one context and a serious security or compliance violation in another, and the difference isn't captured in any single call's attributes. We have to dig into the pattern of calls and the intent behind them. An agent that reads a config file, then queries a database for credentials, then calls an external HTTP endpoint hasn't violated any individual policy rule **in isolation**. Each step may be fully permitted. The threat is the sequence.

## Autonomous Agent Runtime Management (AARM)

This is where agent-native governance toolkits like [Microsoft's Agent Governance Toolkit](https://github.com/microsoft/agent-governance-toolkit) (AGT) come in. AGT is based on the excellent ["AARM" paper](https://arxiv.org/html/2602.09433v1) (Autonomous Action Runtime Management) from [Hermano Errico](https://www.linkedin.com/in/hermanerrico/). 

So what is it that AARM / AGT add on top of something like OPA? Actually these systems do use OPA/cedar/whatever under the covers. So specifically from what I can see it adds is:

- Context / tool call accumulation (history of previous calls, ideally hash-chained)
- Context dependent policy over and above allow/deny
- Intent drift - evaluate API/tool calls and next step tool calls in terms of original intent
- Signed receipts about decisions made given action + context

All of this can be fed into the stateless policy engine to get richer decisioning. I recommend reading the [AARM paper](https://arxiv.org/html/2602.09433v1#S2) for more.

Beyond richer context, AARM also introduces a richer **decision vocabulary** than a plain allow/deny. The paper defines four action categories that the policy engine must be able to return:

| Decision | Meaning |
|---|---|
| **Forbidden** | Hard block regardless of context. No session history needed — these are absolute organizational limits (e.g., `rm -rf /`, known-malicious endpoints). Static policy suffices. |
| **Context-dependent deny** | The action is policy-permitted in isolation but blocked because accumulated session context reveals inconsistency with the user's original intent. Classic example: reading customer PII then immediately emailing an external address — neither action alone triggers a violation, but the composition does. |
| **Context-dependent allow** | Denied by default but permitted when context demonstrates clear alignment with legitimate intent. Deleting database records looks dangerous in isolation; if the session confirms the user said "clean up my test data," blocking it is wrong. Context transforms a default-deny into an informed allow. |
| **Context-dependent defer / escalate** | Risk cannot be conclusively determined from available context. Rather than committing to an unsafe allow or deny, execution is suspended and escalated for human approval — for example, a credential rotation outside a maintenance window where the context is ambiguous. |

The AGT implementation maps these to verdict decisions of `allow`, `deny`, `warn`, `escalate`, and `transform`. The `transform` verdict is particularly interesting: instead of rejecting a response outright, AGT can *mutate* it by redacting PII from a tool result before it reaches the agent's context window, for instance.

One of the big things that stood out to me in the AARM approach is the need for a trusted component to do things like session accumulation and runtime enforcement of policy. It can be done within the agent (SDK), but that's technically within an untrusted domain. That's where agentgateway fits into the picture.

## Microsoft Agent Governance Toolkit with Agentgateway

[Microsoft's Agent Governance Toolkit](https://github.com/microsoft/agent-governance-toolkit) is an implementation of the AARM paper. AARM specifies two main ways to implement its ideas: SDK or proxy/gateway. AGT provides for both. We are going to look at the proxy approach.

Before looking at the configuration, it helps to understand where in the agent lifecycle AGT can intervene. The ACS (Agent Control Specification) — the policy layer inside AGT — defines eight **intervention points** that span the full agent loop:

| Intervention point | When it fires |
|---|---|
| `agent_startup` | Before the agent run begins — evaluate session metadata and identity |
| `input` | At request ingress, before the agent loop starts |
| `pre_model_call` | Before the LLM is called — inspect messages, context, and tool definitions |
| `post_model_call` | After the model responds, before the host acts on it |
| `pre_tool_call` | Before each tool/MCP call executes |
| `post_tool_call` | After each tool result, before it returns to the agent |
| `output` | On the assembled final response to the user |
| `agent_shutdown` | On session termination — evaluate summaries and audit metadata |

This matters for the agentgateway integration because agentgateway covers several of these intervention points directly at the network layer: the `mcpGuardrails` feature maps onto `pre_tool_call` and `post_tool_call`, while agentgateway's existing [LLM guardrails](https://agentgateway.dev/docs/standalone/latest/llm/prompt-guards/) cover `pre_model_call` and `post_model_call`. The remaining points (startup, input, output, shutdown) can be covered by the AGT SDK inside the agent itself, giving you defense in depth across both the application layer and the network layer.


[Agentgateway 1.3](https://github.com/agentgateway/agentgateway/releases/tag/v1.3.0) recently [added a new "mcpGuardrails" functionality](https://github.com/agentgateway/agentgateway/issues/175) (delivered in [PR #1842](https://github.com/agentgateway/agentgateway/pull/1842)) to complement its existing LLM [guardrails capabilities](https://agentgateway.dev/docs/standalone/latest/llm/prompt-guards/) and [External Authz callouts](https://agentgateway.dev/docs/kubernetes/latest/migrate/examples/external-auth/). 

{{< reuse-image src="img/blog/aarm-agt-guardrails/flow-architecture.png"  >}}

The wire protocol is modeled directly on Envoy's `ext_authz`, but operates at the **JSON-RPC method layer** of MCP — gating and mutating individual methods like `tools/call`, `tools/list`, `prompts/get`, and `resources/read` — rather than at the raw HTTP layer. A remote gRPC policy server implements a two-method service:

```protobuf
service ExtMcp {
  rpc CheckRequest(McpRequest) returns (McpRequestResult);
  rpc CheckResponse(McpResponse) returns (McpResponseResult);
}
```

That split matters: `ext_authz` only sees the inbound request, but `mcpGuardrails` also gives the policy server a clean shot at the **response** after agentgateway has merged any fanned-out results into the client-facing view. This is what makes `transform`-style verdicts (redacting PII from a tool result, for example) feasible without each policy server having to re-implement MCP framing and multiplexing.

For example, we can configure this mcpGuardrails like this:

```yaml
  mcp:                                                                                  
    guardrails:                                                                         
      processors:                       # ordered chain, first reject short-circuits    
        - methods:                      # allowlist with phase per method
            "tools/call": Full          # Request | Response | Full | Off
            "*/list": Response          # exact, `prefix/*`, `*/suffix`, or `*`
          remote:                                                                       
            backendRef:                 # Service or Backend                            
              name: my-policy-server
            failureMode: FailClosed     # or FailOpen                                   
            metadata:                   # CEL → google.protobuf.Struct
              tenant: "request.headers['x-tenant']"
            allowedRequestHeaders: [x-tenant]                                           
            disallowedRequestHeaders: [":authority"]    
```

With the mcpGuardrails config we can:

- **Fire per-method checks.** Each processor declares an allowlist of MCP methods it cares about, keyed by method name. Keys can be exact (`tools/call`), prefix wildcards (`tools/*`), suffix wildcards (`*/list`), or `*` for everything. 
- **Choose the phase per method.** Each entry's value is one of `Request`, `Response`, `Full`, or `Off`. `
- **Get a single check for virtual-MCP fanouts.** When agentgateway multiplexes several upstream MCP servers behind one logical endpoint, methods like `tools/list` fan out to every backend. Even so, agentgateway fires **one** `CheckRequest` for the whole client call (with `service_names` listing all targets) and **one** `CheckResponse` on the *merged* result,  so policy servers see exactly what the client sees, not N partial views.
- **Return Pass / Reject / Mutated.** A `Mutated` request replaces the JSON-RPC `params` bytes before they reach the upstream; a `Mutated` response replaces the JSON-RPC `result` before the client sees it. This is what enables AGT's `transform` verdict — redact a field from a `tools/call` argument, drop a tool from a `tools/list` result, scrub a PII column from a database query response. 
- **Pick a failure mode.** `failureMode: FailClosed` (default) rejects the call if the policy server is unreachable or returns garbage; `FailOpen` lets it through. The same setting governs gRPC errors and protocol violations (e.g. a `Mutated` response that doesn't parse back into a valid `ServerResult`).
- **Compose processors.** The `processors` list is an ordered chain; the first to `Reject` short-circuits, mutations from earlier processors are visible to later ones, and metadata maps merge across the chain.

I have put together a demo that digs into the AGT framework with agentgateway.

You can find it here: [https://github.com/christian-posta/agent-governance-agw](https://github.com/christian-posta/agent-governance-agw)

<iframe width="560" height="315" src="https://www.youtube.com/embed/NCZhGs5QfNk" title="YouTube video player" frameborder="0" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share" referrerpolicy="strict-origin-when-cross-origin" allowfullscreen></iframe>

## Try it and get involved

Ready to put MCP guardrails in front of your own agents and tools? Start with the [standalone](https://agentgateway.dev/docs/standalone/latest/quickstart/) or [Kubernetes](https://agentgateway.dev/docs/kubernetes/latest/quickstart/) quickstart, then follow the [MCP guardrails docs](https://agentgateway.dev/docs/standalone/latest/mcp/guardrails/) to wire up an external policy server. Clone the [AGT + agentgateway demo](https://github.com/christian-posta/agent-governance-agw) to walk through the full AARM flow end to end.


* Explore the [docs](https://agentgateway.dev/docs/) and [get started](https://agentgateway.dev/#getting-started) today.
* Star and contribute on [GitHub](https://github.com/agentgateway/agentgateway).
* Join the conversation on [Discord](https://discord.gg/y9efgEmppm).
* Attend our weekly [community meetings](https://github.com/agentgateway/agentgateway?tab=readme-ov-file#community-meetings).

