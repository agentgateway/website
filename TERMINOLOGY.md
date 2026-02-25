# Terminology

Use this reference when writing or editing docs so that users coming from other environments can find equivalent features. Lead with the familiar or competitor term (the language people search for); then use our more declarative terms in the rest of the sentence. Incorporate the language into the sentence instead of adding all terms in brackets.

---

## Rate limiting and cost control

| Agentgateway term | Alternative terms | Use in |
|--------------------|-------------------------------|--------|
| Rate limiting (token-based) | Budget limits, spend limits, spend limits per key, cost control, per-key limits | Rate limit docs, spending docs, resiliency cards |
| Token-based rate limit (per user/key) | Virtual keys (when combined with auth), per-API-key budgets | Virtual key pattern, API keys, rate limit intros |
| Control spend / token limits | Budget enforcement, token budget, cost control | Spending guide, LLM about |

Example:  
"Control cost with token budgets and spend limits to prevent unexpected bills and LLM misuse."  
"Enforce budget and spend limits per key by controlling request and token usage."

---

## API keys and virtual keys

| Agentgateway term | Alternative terms | Use in |
|-------------------|-------------------|--------|
| API key authentication | Virtual keys | API keys docs, auth guides |
| API key + per-key rate limits + analytics (composed) | Virtual key management, virtual keys, per-key budgets | Rate limit docs, auth docs, “virtual key pattern” guide |
| Per-key token budgets / spend limits | Virtual key budgets, spend limits per key | API keys, rate limiting, spending |
| Key per user/team with identity (such as X-User-ID) | Virtual keys, per-user keys | API key auth, rate limit keying |

Note: Other AI gateways often offer a single “virtual keys” feature that bundles API key auth, per-key budgets, and usage analytics. In agentgateway, you get the same capability by composing API key authentication, token-based rate limiting (keyed by user/header), and OTel metrics/traces.

Example:  
"Manage virtual keys—issue API keys and attach per-key token budgets."

---

## Observability and logging

| Agentgateway term | Alternative terms | Use in |
|--------------------|-------------------------------|--------|
| LLM metrics / traces / telemetry | Prompt logging, request/response logging, cost tracking, audit trail | Observability docs, telemetry tutorial, LLM observability index |
| Observe traffic / LLM metrics | Cost tracking, token usage tracking, prompt analytics | Observe traffic page, integrations |
| Export traces to Langfuse/LangSmith | LLM logging, prompt logging, audit trail | Export guides, observability overview |

Example:  
"Get prompt logging, cost tracking, and an audit trail for LLM traffic."  
Only mention specific platforms (e.g. Langfuse, LangSmith) on pages that actually document them.

---

## Content safety and guards

| Agentgateway term | Alternative terms | Use in |
|--------------------|-------------------------------|--------|
| Prompt guard / AI Prompt Guard | Content safety, PII detection, DLP (data loss prevention), NER-based PII | Prompt guard docs, guardrails, security |
| Block sensitive data / PII | PII detection, content safety, data loss prevention | AI Prompt Guard description, guardrails intro |

Example:  
"Use content safety and PII detection: configure agentgateway to inspect and filter LLM requests and block sensitive data like PII before it reaches AI models."

---

## Load balancing and routing

| Agentgateway term | Alternative terms | Use in |
|-------------------|-------------------|--------|
| Load balancing (weighted) | P2C (Power of Two Choices), Power of Two Choices algorithm | Load balancing docs, provider routing |
| Traffic splitting / weighted backends | A/B testing, traffic splitting, canary deployments, model comparison | Load balancing, failover, routing |
| Priority groups / failover order | Failover, fallback, automatic failover | Failover docs |
| Route to multiple providers with weights | Round-robin, least-connections, least-latency (P2C subsumes these) | Load balancing intro |

Note: Agentgateway uses the Power of Two Choices (P2C) algorithm for load balancing. Use “P2C” and “Power of Two Choices” in intros and descriptions so users comparing to other gateways recognize the approach. Traffic splitting (such as 80% to one model, 20% to another) can be framed as A/B testing or canary deployments for LLM providers.

Example:  
"Set up traffic splitting, A/B testing, or canary deployments with weight-based routing."  
"Use failover (automatic fallback) to keep services running by switching to a backup when the main system fails."

---

## Where to add alternative terms

- Page `description` (front matter): Lead with the familiar term, then the action or outcome. Example: "Control cost with token budgets and spend limits to prevent unexpected bills and LLM misuse."
- First paragraph or intro: Weave the discoverable term into the sentence. Example: "Get prompt logging, cost tracking, and an audit trail: review LLM-specific metrics, logs, and traces via OpenTelemetry."
- Card subtitles: Use the familiar language. Example: "Budget and spend limits" under Rate limiting.

Do not list every alternative in brackets. Do not mention specific products (e.g. Langfuse, LangSmith) in a description unless that page documents them.
