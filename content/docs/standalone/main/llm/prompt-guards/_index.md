---
title: Guardrails
weight: 60
description: Protect LLM interactions with prompt guards that evaluate and filter requests and responses for harmful or policy-violating content.
---

Guardrails are security policies that inspect LLM requests and responses to detect and block harmful, policy-violating, or inappropriate content before it reaches the model or the user. You can apply prompt guards to the request phase, the response phase, or both.

To learn more about guardrails, see the following topic. 
{{< cards >}}
  {{< card link="overview" title="About guardrails" description="Track content safety metrics and blocked requests." >}}
{{< /cards >}}

To set up guardrails, check out the following guides. 

{{< cards >}}
  {{< card link="regex" title="Regex filters" description="Use custom regex patterns and built-in PII detectors to filter LLM requests and responses." >}}
  {{< card link="moderation" title="OpenAI moderation" description="Use the OpenAI Moderation API to detect harmful content across categories including hate, harassment, and violence." >}}
  {{< card link="bedrock-guardrails" title="AWS Bedrock Guardrails" description="Apply AWS Bedrock Guardrails to filter LLM requests and responses for policy-violating content." >}}
  {{< card link="google-model-armor" title="Google Model Armor" description="Apply Google Cloud Model Armor templates to sanitize LLM requests and responses." >}}
  {{< card link="pillar-security" title="Pillar Security" description="Detect prompt injections, jailbreaks, PII, secrets, and toxic language with Pillar Security guardrails." >}}
  {{< card link="webhook" title="Custom webhooks" description="Integrate your own content safety logic by forwarding requests and responses to a custom webhook." >}}
  {{< card link="multi-layer" title="Multi-layered guardrails" description="Run prompt guards in sequence, creating defense-in-depth protection." >}}
{{< /cards >}}

To track guardrails and content safety, see the following guide. 

{{< cards >}}
  {{< card link="../../observability" title="Observe LLM traffic" description="Track content safety metrics and blocked requests." >}}
{{< /cards >}}
