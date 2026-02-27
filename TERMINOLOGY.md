# Terminology

Use this reference when writing or editing docs so that users coming from other environments can find equivalent features. Use our term first, then add "also known as" or similar phrasing in short descriptions, intros, and metadata where it helps discoverability.

---

## Rate limiting and cost control

| Agentgateway term | Alternative terms | Use in |
|--------------------|-------------------------------|--------|
| Rate limiting (token-based) | Budget limits, spend limits, spend limits per key, cost control, per-key limits | Rate limit docs, spending docs, resiliency cards |
| Token-based rate limit (per user/key) | Virtual keys (when combined with auth), per-API-key budgets | Virtual key pattern, API keys, rate limit intros |
| Control spend / token limits | Budget enforcement, token budget, cost control | Spending guide, LLM about |

Example phrasing:  
"Rate limiting (also known as budget limits or spend limits when applied per user or API key) lets you cap token usage per time window."

---

## API keys and virtual keys

| Agentgateway term | Alternative terms | Use in |
|-------------------|-------------------|--------|
| API key authentication | Virtual keys | API keys docs, auth guides |
| API key + per-key rate limits + analytics (composed) | Virtual key management, virtual keys, per-key budgets | Rate limit docs, auth docs, “virtual key pattern” guide |
| Per-key token budgets / spend limits | Virtual key budgets, spend limits per key | API keys, rate limiting, spending |
| Key per user/team with identity (such as X-User-ID) | Virtual keys, per-user keys | API key auth, rate limit keying |

Note: Other AI gateways often offer a single “virtual keys” feature that bundles API key auth, per-key budgets, and usage analytics. In agentgateway, you get the same capability by composing API key authentication, token-based rate limiting (keyed by user/header), and OTel metrics/traces.

Example phrasing:  
"Issue API keys and attach per-key token budgets (also known as virtual keys or virtual key management)."

---

## Observability and logging

| Agentgateway term | Alternative terms | Use in |
|--------------------|-------------------------------|--------|
| LLM metrics / traces / telemetry | Prompt logging, request/response logging, cost tracking, audit trail | Observability docs, telemetry tutorial, LLM observability index |
| Observe traffic / LLM metrics | Cost tracking, token usage tracking, prompt analytics | Observe traffic page, integrations |
| Export traces to Langfuse/LangSmith | LLM logging, prompt logging, audit trail | Export guides, observability overview |

Example phrasing:  
"Review LLM-specific metrics, logs, and traces (prompt logging, cost tracking, audit trail)."

---

## Content safety and guards

| Agentgateway term | Alternative terms | Use in |
|--------------------|-------------------------------|--------|
| Prompt guard / AI Prompt Guard | Content safety, PII detection, DLP (data loss prevention), NER-based PII | Prompt guard docs, guardrails, security |
| Block sensitive data / PII | PII detection, content safety, data loss prevention | AI Prompt Guard description, guardrails intro |

Example phrasing:  
"Protect LLM requests from prompt injection and sensitive data exposure (content safety, PII detection)."

---

## Load balancing and routing

| Agentgateway term | Alternative terms | Use in |
|-------------------|-------------------|--------|
| Load balancing (weighted) | P2C (Power of Two Choices), Power of Two Choices algorithm | Load balancing docs, provider routing |
| Traffic splitting / weighted backends | A/B testing, traffic splitting, canary deployments, model comparison | Load balancing, failover, routing |
| Priority groups / failover order | Failover, fallback, automatic failover | Failover docs |
| Route to multiple providers with weights | Round-robin, least-connections, least-latency (P2C subsumes these) | Load balancing intro |

Note: Agentgateway uses the Power of Two Choices (P2C) algorithm for load balancing. Use “P2C” and “Power of Two Choices” in intros and descriptions so users comparing to other gateways recognize the approach. Traffic splitting (such as 80% to one model, 20% to another) can be framed as A/B testing or canary deployments for LLM providers.

Example phrasing:  
"Load balance across LLM providers using the Power of Two Choices (P2C) algorithm, with failover and optional traffic splitting (A/B testing, canary)."

---

## Where to add alternative terms

- Page `description` (front matter): One short phrase, such as "Rate limiting and budget control (spend limits per key)."
- First paragraph or intro: One sentence with "also known as" or parenthetical, such as "(sometimes called prompt logging or cost tracking)."
- Card subtitles on index pages: such as "Budget and spend limits" under Rate limiting.
- H1 or first heading: Prefer our term; optional parenthetical for one well-known alternative.

Do not over-stuff. One extra phrase per page or card is enough for SEO and discoverability.
