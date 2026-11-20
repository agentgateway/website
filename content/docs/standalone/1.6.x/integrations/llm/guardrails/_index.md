---
title: Guardrails
weight: 30
description: Connect agentgateway to external content-safety and evaluation services through the Guardrail Webhook API.
test: skip
---

Agentgateway calls a guardrail webhook before it sends a prompt to an LLM, and again before it returns the response to the client. The webhook decides whether to pass, mask, or reject the content, so you can enforce safety and compliance rules with a service of your choice.

This section covers the guardrail services that agentgateway reaches through the [Guardrail Webhook API]({{< link-hextra path="/documentation/llm/prompt-guards/webhooks/" >}}). For the services that agentgateway calls natively, such as Azure Content Safety, AWS Bedrock Guardrails, and Google Model Armor, see [Prompt guards]({{< link-hextra path="/documentation/llm/prompt-guards/overview/" >}}).
