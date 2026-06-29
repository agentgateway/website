---
title: LLM playground
weight: 85
description: Send a test chat completion through the gateway in the agentgateway admin UI.
test: skip
---

Use the built-in LLM playground in the agentgateway admin UI to send a chat completion request through your configured LLM provider. The playground sends a real request through the gateway, so you can confirm that your provider, model, and policies work before you point an application at agentgateway.

{{< callout type="info" >}}
The LLM playground is available in the agentgateway UI in version 1.3 and later.
{{< /callout >}}

## Before you begin

1. {{< reuse "agw-docs/snippets/prereq-agentgateway.md" >}}
2. Configure at least one LLM provider. For an example, see [OpenAI]({{< link-hextra path="/llm/providers/openai/" >}}) or any [OpenAI-compatible provider]({{< link-hextra path="/llm/providers/custom/" >}}).

## Send a test request

1. Run agentgateway with your LLM configuration.

   ```sh
   agentgateway -f config.yaml
   ```

2. Open the [LLM playground](http://localhost:15000/ui/llm/playground/).

3. If you see a **Browser access is not allowed** notice, click **Apply CORS** so the playground can call the LLM listener from the UI.

4. In the **Model** list, select a model. If your configuration uses a wildcard (`*`) model, enter a specific model name in the **Specific model** field, such as `gpt-4o-mini`.

5. Optional: Expand **System prompt** to review or change the system prompt.

6. In the **User message** box, enter a prompt, such as `Say hello to agentgateway`, and click **Send**.

7. Verify that the gateway forwards the request to your provider and returns a response in the chat panel. Each response also shows the provider, model, latency, and token usage.

   {{< reuse-image-light src="img/ui-llm-playground.png" >}}
   {{< reuse-image-dark srcDark="img/ui-llm-playground-dark.png" >}}

## Next steps

- [Observe LLM traffic]({{< link-hextra path="/llm/observability/" >}}) with metrics, logs, and traces.
- Try out CEL expressions in the [CEL playground]({{< link-hextra path="/reference/cel/playground/" >}}).
