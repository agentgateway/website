---
title: Guardrails
weight: 30
description: Connect agentgateway to external content-safety and evaluation services through the Guardrail Webhook API.
test: skip
---

Agentgateway calls a guardrail webhook before it sends a prompt to an LLM, and again before it returns the response to the client. The webhook decides whether to pass, mask, or reject the content, so you can enforce safety and compliance rules with a service of your choice.

For the webhook contract and the built-in prompt guards, see [Custom webhooks]({{< link-hextra path="/documentation/llm/prompt-guards/webhooks/" >}}) and [Prompt guards]({{< link-hextra path="/documentation/llm/prompt-guards/overview/" >}}).
