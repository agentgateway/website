Configure Meta as an LLM provider in agentgateway. The `meta` preset supports the Chat Completions, Messages, and Responses APIs.

## Before you begin

{{< reuse "agw-docs/snippets/prereq-agentgateway.md" >}}

You need agentgateway 1.6.0 or later and a Meta Model API key. Create a key in the [Meta Model API dashboard](https://dev.meta.ai/).

## Configuration

Use the `meta` preset to route requests to the Meta Model API. The preset supplies the provider URL and supported request formats.

{{< doc-test paths="meta-validate" >}}
# Validate the configuration without calling the Meta API. A placeholder key
# is sufficient because --validate-only resolves environment variables.
{{< reuse "agw-docs/snippets/install-agentgateway-binary.md" >}}
export META_API_KEY="test"
{{< /doc-test >}}

{{% version exclude-if="1.0.x,1.1.x,1.2.x,1.3.x,1.4.x,1.5.x,1.6.x,2.2.x" %}}
You can add the model in the UI or in your configuration file.

{{< tabs >}}
{{% tab name="UI" %}}
To add the model in the [UI]({{< link-hextra path="/documentation/setup/ui/launch-ui/" >}}), follow these steps. The steps create the same model as the **Config file** tab.

1. Set your API key in the `META_API_KEY` environment variable. The UI checks that the variable exists when you save the model.

   ```sh
   export META_API_KEY='<your-api-key>'
   ```

2. {{< reuse "agw-docs/standalone/llm/providers/ui-start-empty-llm.md" >}}
3. Open **LLM** > **Models**, such as [http://localhost:15000/ui/llm/models](http://localhost:15000/ui/llm/models), and click **Add model**.
4. From the **Provider** dropdown, select **Meta**.
5. In the **Incoming model match** field, replace the default `meta/*` with `*`.
6. For the **Provider API key**, select **Env var**, and enter `META_API_KEY`.
7. For **Outgoing model**, keep **Incoming model**. To send every request to one model instead, select **Explicit**, and enter the model name, such as `muse-spark-1.3`. This option sets `params.model`.

   {{< reuse-image src="img/ui-llm-add-model-meta.png" srcDark="img/ui-llm-add-model-meta-dark.png" alt="Add model drawer with Meta selected as the provider, the * wildcard as the incoming model match, and META_API_KEY as the environment variable for the provider API key" >}}

8. Click **Save model**.

{{< reuse "agw-docs/standalone/llm/providers/ui-add-model-notes.md" >}}
{{% /tab %}}
{{% tab name="Config file" %}}
{{< reuse "agw-docs/standalone/llm/providers/meta-config.md" >}}
{{% /tab %}}
{{< /tabs >}}
{{% /version %}}
{{% version include-if="1.0.x,1.1.x,1.2.x,1.3.x,1.4.x,1.5.x,1.6.x,2.2.x" %}}
{{< reuse "agw-docs/standalone/llm/providers/meta-config.md" >}}
{{% /version %}}

## Example request

From another terminal, send a Chat Completions request to the gateway. This example uses `muse-spark-1.3`, as shown in the [Meta quickstart](https://dev.meta.ai/docs/cookbook/quickstart-chat-completions). Use a model that your Meta account can access.

```sh
curl http://localhost:4000/v1/chat/completions \
  -H 'Content-Type: application/json' \
  -d '{
    "model": "muse-spark-1.3",
    "messages": [{"role": "user", "content": "Hello from Meta!"}]
  }'
```

<!-- The meta-validate test checks configuration parsing only. This request needs
     a real Meta API key and is intentionally excluded from that test. -->
