---
title: Guardrails
weight: 60
description: Protect LLM interactions with prompt guards that evaluate and filter requests and responses for harmful or policy-violating content.
---

Guardrails are security policies that inspect LLM requests and responses to detect and block harmful, policy-violating, or inappropriate content before it reaches the model or the user. You can apply prompt guards to the request phase, the response phase, or both.

Agentgateway supports the following prompt guard options:

- **Regex filters**: Use custom regex patterns or built-in PII detectors to reject requests or mask responses that contain sensitive data such as SSNs, email addresses, or credentials.
- **AWS Bedrock Guardrails**: Use [AWS-managed guardrail policies](https://aws.amazon.com/bedrock/guardrails/) to filter content based on topics, words, PII, and other safety criteria.
- **Google Model Armor**: Use [Google Cloud's Model Armor service](https://docs.cloud.google.com/model-armor/overview) to sanitize user prompts and model responses against configurable safety templates.

{{< cards >}}
  {{< card link="regex" title="Regex filters" >}}
  {{< card link="bedrock-guardrails" title="AWS Bedrock Guardrails" >}}
  {{< card link="google-model-armor" title="Google Model Armor" >}}
{{< /cards >}}
