Configure [Google Gemini](https://gemini.google.com/) as an LLM provider in {{< reuse "agw-docs/snippets/agentgateway.md" >}}.

## Before you begin

{{< reuse "agw-docs/snippets/prereq-agentgateway.md" >}}

## Set up access to Gemini
{{< reuse "agw-docs/snippets/gemini-setup.md" >}}

{{% version exclude-if="1.0.x,1.1.x,1.2.x,1.3.x,1.4.x,1.5.x,1.6.x,1.7.x,2.2.x" %}}
{{< reuse "agw-docs/snippets/gemini-reasoning-effort.md" >}}

For Gemma 4 models, `none`, `minimal`, and `low` use `thinkingLevel: "minimal"`, and `medium`, `high`, `xhigh`, and `max` use `thinkingLevel: "high"`.
{{% /version %}}

{{< reuse "agw-docs/snippets/agentgateway/llm-next.md" >}}
