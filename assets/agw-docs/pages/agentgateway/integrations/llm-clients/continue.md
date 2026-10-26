Configure [Continue](https://continue.dev/), the open-source AI code assistant for VS Code, to route requests through agentgateway.

## Before you begin

1. {{< reuse "agw-docs/snippets/prereq-agentgateway.md" >}}
2. Install VS Code with the [Continue extension](https://marketplace.visualstudio.com/items?itemName=Continue.continue).

## Example agentgateway configuration

{{% version exclude-if="1.0.x,1.1.x,1.2.x,1.3.x,1.4.x,1.5.x,1.6.x,2.2.x" %}}
You can configure agentgateway in the UI or in your configuration file.

{{< tabs >}}
{{% tab name="UI" %}}
{{< reuse "agw-docs/standalone/llm/clients/ui-openai-port-3000.md" >}}
{{% /tab %}}
{{% tab name="Config file" %}}
{{< reuse "agw-docs/pages/agentgateway/integrations/llm-clients/continue-config.md" >}}
{{% /tab %}}
{{< /tabs >}}
{{% /version %}}
{{% version include-if="1.0.x,1.1.x,1.2.x,1.3.x,1.4.x,1.5.x,1.6.x,2.2.x" %}}
{{< reuse "agw-docs/pages/agentgateway/integrations/llm-clients/continue-config.md" >}}
{{% /version %}}

## Configure Continue

1. Edit the `~/.continue/config.yaml` file to add your agentgateway endpoint. If the file already has a `models` list, add the model to that list.
2. Save the file and reload Continue in VS Code.

```yaml
name: agentgateway
version: 0.0.1
schema: v1
models:
  - name: agentgateway
    provider: openai
    model: gpt-4o-mini
    apiBase: http://localhost:3000/v1
```

{{% reuse "agw-docs/snippets/review-table.md" %}}

| Field | Description |
|-------|-------------|
| `name` | At the top level, a name for the configuration. In the `models` list, the display name shown in the Continue model selector. |
| `version`, `schema` | Required by the Continue `config.yaml` format. Keep `schema: v1`. |
| `provider` | Set to `openai` for any OpenAI-compatible endpoint. |
| `model` | The model name from your agentgateway backend configuration. |
| `apiBase` | Your agentgateway URL with the `/v1` path. |

## Verify the connection

1. Open the Continue sidebar in VS Code (`Cmd + L` on macOS, `Ctrl + L` on Windows/Linux).
2. Select **agentgateway** from the model dropdown.
3. Send a test message: "Hello, are you working?"
