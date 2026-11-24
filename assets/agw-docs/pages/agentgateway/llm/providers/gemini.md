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

Create a separate {{< reuse "agw-docs/snippets/backend.md" >}} and HTTPRoute for decision models, so that the `google` {{< reuse "agw-docs/snippets/backend.md" >}} and route that you created earlier keep serving chat requests.

1. Create a {{< reuse "agw-docs/snippets/backend.md" >}} for the decision model.

   ```yaml
   kubectl apply -f- <<EOF
   apiVersion: {{< reuse "agw-docs/snippets/api-version.md" >}}
   kind: {{< reuse "agw-docs/snippets/backend.md" >}}
   metadata:
     name: google-decisions
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

   {{% reuse "agw-docs/snippets/review-table.md" %}}

   | Setting | Description |
   |---------|-------------|
   | `gemini.model` | A Gemini decision model, such as `gemini-decision-1`. Chat models do not answer Decisions requests. {{< reuse "agw-docs/snippets/agentgateway-capital.md" >}} sends this name upstream and replaces the `model` value in the client request. |
   | `policies.auth.secretRef` | The Secret with your Gemini API key that you created earlier. |
   | `policies.ai.routes` | Maps each request path to a request format. Requests to `/v1/decisions` use the Decisions format, and requests to `/v1/systemone` use the SystemOne format. |

2. Create an HTTPRoute that sends both request paths to the {{< reuse "agw-docs/snippets/backend.md" >}}. The exact path matches take precedence over the prefix match of the `google` HTTPRoute, whichever tab you used to create it.

   ```yaml
   kubectl apply -f- <<EOF
   apiVersion: gateway.networking.k8s.io/v1
   kind: HTTPRoute
   metadata:
     name: google-decisions
     namespace: {{< reuse "agw-docs/snippets/namespace.md" >}}
   spec:
     parentRefs:
     - name: agentgateway-proxy
     rules:
     - backendRefs:
       - group: {{< reuse "agw-docs/snippets/group.md" >}}
         kind: {{< reuse "agw-docs/snippets/backend.md" >}}
         name: google-decisions
       matches:
       - method: POST
         path:
           type: Exact
           value: /v1/decisions
       - method: POST
         path:
           type: Exact
           value: /v1/systemone
   EOF
   ```

3. Send a Decisions request.

   **Cloud Provider LoadBalancer**:
   ```sh
   curl "$INGRESS_GW_ADDRESS/v1/decisions" -H content-type:application/json -d '{
     "model": "gemini-decision-1",
     "input": [{"role": "user", "content": [{"type": "input_text", "text": "The package was left in the rain and the box is soaked through."}]}],
     "questions": [{"type": "predicate", "name": "visible_damage", "instructions": "Does the customer report visible damage to the package?"}]
   }' | jq
   ```

   **Localhost**:
   ```sh
   curl "localhost:8080/v1/decisions" -H content-type:application/json -d '{
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

{{% version exclude-if="1.0.x,1.1.x,1.2.x,1.3.x,1.4.x,1.5.x,1.6.x,1.7.x,2.2.x" %}}
## Use structured outputs {#structured-outputs}

{{< reuse "agw-docs/snippets/gemini-structured-outputs.md" >}}

1. Save the request body to a file.

   ```sh
   cat > structured-request.json <<'EOF'
   {
     "model": "",
     "messages": [
       {
         "role": "user",
         "content": "Return one calendar event for tomorrow."
       }
     ],
     "response_format": {
       "type": "json_schema",
       "json_schema": {
         "name": "calendar_event",
         "strict": true,
         "schema": {
           "$defs": {
             "CalendarEvent": {
               "type": "object",
               "additionalProperties": false,
               "properties": {
                 "name": { "type": "string" },
                 "date": { "type": "string" }
               },
               "required": ["name", "date"]
             }
           },
           "type": "object",
           "additionalProperties": false,
           "properties": {
             "event": { "$ref": "#/$defs/CalendarEvent" }
           },
           "required": ["event"]
         }
       }
     }
   }
   EOF
   ```

2. Send the request. This example uses the path from the **Gemini default** tab. If you used another tab, change the path to match your HTTPRoute, such as `/v1/chat/completions` or `/gemini`.

   **Cloud Provider LoadBalancer**:
   ```sh
   curl "$INGRESS_GW_ADDRESS/v1beta/openai/chat/completions" -H content-type:application/json -d @structured-request.json | jq
   ```

   **Localhost**:
   ```sh
   curl "localhost:8080/v1beta/openai/chat/completions" -H content-type:application/json -d @structured-request.json | jq
   ```

   Example output, in which `content` is a JSON string that matches the schema:

   ```json
   {
     "model": "gemini-2.5-flash",
     "choices": [
       {
         "index": 0,
         "message": {
           "role": "assistant",
           "content": "{\"event\":{\"name\":\"Team sync\",\"date\":\"2026-11-25\"}}"
         },
         "finish_reason": "stop"
       }
     ],
     ...
   }
   ```
{{% /version %}}

{{< reuse "agw-docs/snippets/agentgateway/llm-next.md" >}}
