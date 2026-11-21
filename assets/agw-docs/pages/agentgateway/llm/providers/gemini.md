Configure [Google Gemini](https://gemini.google.com/) as an LLM provider in {{< reuse "agw-docs/snippets/agentgateway.md" >}}.

## Before you begin

{{< reuse "agw-docs/snippets/prereq-agentgateway.md" >}}

## Set up access to Gemini
{{< reuse "agw-docs/snippets/gemini-setup.md" >}}

{{% version exclude-if="1.0.x,1.1.x,1.2.x,1.3.x,1.4.x,1.5.x,1.6.x,1.7.x,2.2.x" %}}
{{< reuse "agw-docs/snippets/gemini-reasoning-effort.md" >}}

For Gemma 4 models, `none`, `minimal`, and `low` use `thinkingLevel: "minimal"`, and `medium`, `high`, `xhigh`, and `max` use `thinkingLevel: "high"`.
{{% /version %}}

{{% version exclude-if="1.0.x,1.1.x,1.2.x,1.3.x,1.4.x,1.5.x,1.6.x,1.7.x,2.2.x" %}}
## Use Decisions and SystemOne {#decisions}

Gemini decision models, such as `gemini-decision-1`, can answer OpenAI Decisions (`/v1/decisions`) and TypeSafe SystemOne (`/v1/systemone`) requests. {{< reuse "agw-docs/snippets/agentgateway-capital.md" >}} converts both formats to the Gemini Decisions API (`/v1beta/decisions`) and converts the answers back to the client's format. The conversion is best effort. For the supported request content, see [Decisions]({{< link-hextra path="/documentation/llm/api-types/decisions/#supported-providers" >}}).

1. Update the `google` {{< reuse "agw-docs/snippets/backend.md" >}} to use a decision model and to map the Decisions and SystemOne paths. This command replaces the {{< reuse "agw-docs/snippets/backend.md" >}} that you created earlier. The `google` HTTPRoute from the **Gemini default** tab already sends all paths to this {{< reuse "agw-docs/snippets/backend.md" >}}.

   ```yaml
   kubectl apply -f- <<EOF
   apiVersion: {{< reuse "agw-docs/snippets/api-version.md" >}}
   kind: {{< reuse "agw-docs/snippets/backend.md" >}}
   metadata:
     name: google
     namespace: {{< reuse "agw-docs/snippets/namespace.md" >}}
   spec:
     ai:
       provider:
         gemini:
           model: gemini-decision-1
     policies:
       auth:
         secretRef:
           name: google-secret
       ai:
         routes:
           "/v1/decisions": "Decisions"
           "/v1/systemone": "SystemOne"
   EOF
   ```

2. Send a Decisions request.

   ```sh
   curl "$INGRESS_GW_ADDRESS/v1/decisions" -H content-type:application/json -d '{
     "model": "gemini-decision-1",
     "input": [{"role": "user", "content": [{"type": "input_text", "text": "The package was left in the rain and the box is soaked through."}]}],
     "questions": [{"type": "predicate", "name": "visible_damage", "instructions": "Does the customer report visible damage to the package?"}]
   }' | jq
   ```

   Example output:

   ```json
   {
     "model": "gemini-decision-1",
     "answers": [
       {"type": "predicate", "name": "visible_damage", "probability": 0.64}
     ],
     "usage": {"input_tokens": 156, "output_tokens": 0, "total_tokens": 156, ...}
   }
   ```
{{% /version %}}

{{< reuse "agw-docs/snippets/agentgateway/llm-next.md" >}}
