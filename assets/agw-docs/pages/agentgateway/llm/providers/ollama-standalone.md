Configure [Ollama](https://ollama.com/) to serve local models through agentgateway. Agentgateway 1.3 includes the first-class `ollama` provider and automatically uses `http://localhost:11434/v1` unless you override it.

## Before you begin

1. {{< reuse "agw-docs/snippets/prereq-agentgateway.md" >}}

2. Install [Ollama](https://ollama.com/download).

3. Make sure that you have at least one model pulled locally.

   ```sh
   ollama list
   ```

   If not, pull a model.

   ```sh
   ollama pull llama3.2
   ```

## Configure agentgateway

{{% version exclude-if="1.0.x,1.1.x,1.2.x,1.3.x,1.4.x,1.5.x,1.6.x,2.2.x" %}}
You can configure agentgateway in the UI or in your configuration file.

{{< tabs >}}
{{% tab name="UI" %}}
To create the same configuration in the [UI]({{< link-hextra path="/documentation/setup/ui/launch-ui/" >}}), follow these steps.

1. Create a configuration file with an empty `llm` section, and start agentgateway.

   ```sh
   cat > config.yaml <<'EOF'
   llm:
     models: []
   EOF
   agentgateway -f config.yaml
   ```

2. Add the model.
   1. Open **LLM** > **Models**, such as [http://localhost:15000/ui/llm/models](http://localhost:15000/ui/llm/models), and click **Add model**.
   2. From the **Provider** dropdown, select **Ollama**.
   3. Keep the default `ollama/*` in the **Incoming model match** field.
   4. Keep **Unset** for the **Provider API key**.
   5. If Ollama runs somewhere other than `http://localhost:11434/v1`, enter the **Base URL**, such as `http://192.168.1.20:11434/v1`. Otherwise, leave the field empty.
   6. For the **Outgoing model**, select **Explicit**, and enter `llama3.2`.

      {{< reuse-image src="img/ui-llm-add-model-ollama-prefix.png" srcDark="img/ui-llm-add-model-ollama-prefix-dark.png" alt="Add model drawer with the Ollama provider, ollama/* as the incoming model match, no provider API key, and llama3.2 as the explicit outgoing model" >}}

   7. Click **Save model**.
3. Serve LLM traffic on port `3000`.
   1. Open the **Gateway Overview** page, such as [http://localhost:15000/ui/](http://localhost:15000/ui/).
   2. On the **LLM** row, click **Settings**.
   3. Enter `3000` for the **Port**, and click **Save settings**.

      {{< reuse-image src="img/ui-llm-settings-port.png" srcDark="img/ui-llm-settings-port-dark.png" alt="LLM Settings drawer with the Gateway binding port set to 3000 and a Save settings button" >}}

The UI writes the same deprecated `llm.port` field as the **Config file** tab, plus an empty `llm.gateways` list. If your configuration defines `gateways`, the **Settings** drawer shows a **Gateway** dropdown instead of **Port**, and binds LLM traffic to the gateway that you select.

Whether the UI can save depends on your storage mode. For more information, see [Save changes from the UI]({{< link-hextra path="/documentation/setup/ui/launch-ui/#save-changes" >}}).
{{% /tab %}}
{{% tab name="Config file" %}}
{{< reuse "agw-docs/pages/agentgateway/llm/providers/ollama-standalone-config.md" >}}
{{% /tab %}}
{{< /tabs >}}
{{% /version %}}
{{% version include-if="1.0.x,1.1.x,1.2.x,1.3.x,1.4.x,1.5.x,1.6.x,2.2.x" %}}
{{< reuse "agw-docs/pages/agentgateway/llm/providers/ollama-standalone-config-1.6-earlier.md" >}}
{{% /version %}}

## Test the configuration

Send a request to verify that agentgateway routes to Ollama.

{{% version exclude-if="1.0.x,1.1.x,1.2.x,1.3.x,1.4.x,1.5.x,1.6.x,2.2.x" %}}
The model name in the request must start with the `ollama/` prefix. Because the configuration sets `params.model`, every request goes to `llama3.2`.

```sh
curl http://localhost:3000/v1/chat/completions \
  -H "content-type: application/json" \
  -d '{
    "model": "ollama/llama3.2",
    "messages": [
      {
        "role": "user",
        "content": "Explain Ollama in one sentence."
      }
    ]
  }' | jq
```
{{% /version %}}
{{% version include-if="1.0.x,1.1.x,1.2.x,1.3.x,1.4.x,1.5.x,1.6.x,2.2.x" %}}
The model name in the request must match a model you already pulled with `ollama pull`.

```sh
curl http://localhost:3000/v1/chat/completions \
  -H "content-type: application/json" \
  -d '{
    "model": "llama3.2",
    "messages": [
      {
        "role": "user",
        "content": "Explain Ollama in one sentence."
      }
    ]
  }' | jq
```
{{% /version %}}

## Troubleshooting

### Connection refused

**What's happening:**

Requests to agentgateway return a 503 response or a connection refused error.

**Why it's happening:**

Ollama is not running, is listening on a different address, or `params.baseUrl` points to the wrong endpoint.

**How to fix it:**

1. Verify Ollama is reachable directly.

   ```sh
   curl http://localhost:11434/api/version
   ```

2. If Ollama is not running, start it.

   ```sh
   ollama serve
   ```

3. If you set `params.baseUrl`, make sure it includes Ollama's `/v1` prefix.

### Model not found

**What's happening:**

The response returns a model not found error.

**Why it's happening:**

The requested model has not been pulled into your local Ollama instance.

**How to fix it:**

1. List available models.

   ```sh
   ollama list
   ```

2. Pull the missing model.

   ```sh
   ollama pull llama3.2
   ```
