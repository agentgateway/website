Configure [Claude Code](https://code.claude.com/docs), the AI coding CLI by Anthropic, to route LLM requests through your agentgateway proxy.

The primary use case is routing Claude Code to non-Anthropic LLM backends (such as vLLM, Ollama, or any OpenAI-compatible provider) for cost optimization and flexibility. You can also configure direct routing to Anthropic or use a Claude Teams account as alternative options.

## Before you begin

1. {{< reuse "agw-docs/snippets/prereq-agentgateway.md" >}}
2. Install the [Claude Code CLI](https://code.claude.com/docs) (`npm install -g @anthropic-ai/claude-code`).

{{< reuse "agw-docs/snippets/llm-client-setup-callout.md" >}}

> [!NOTE]
> The `CLAUDE_CODE_DISABLE_EXPERIMENTAL_BETAS` environment variable disables Claude Code's experimental beta features. You typically **do not need** this variable when proxying to non-Anthropic backends or standard Anthropic routing.
>
> Only set this variable if you encounter errors like `Extra inputs are not permitted` when using advanced Anthropic features (such as experimental translation or extended thinking). If you use a non-Anthropic backend, this variable can be safely omitted.

## Configure agentgateway with OpenAI-compatible backend

Route Claude Code to any OpenAI-compatible LLM provider (such as vLLM, Ollama, or local language models). This is the recommended approach for cost-effective and flexible deployment.

### Set up agentgateway {#openai-setup}

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

2. Open **LLM** > **Models**, such as [http://localhost:15000/ui/llm/models](http://localhost:15000/ui/llm/models), and click **Add model**.
3. From the **Provider** dropdown, select **OpenAI**.
4. In the **Incoming model match** field, replace the default `openai/*` with `*`.
5. For the **Provider API key**, select **API key**, and enter `mock-key`.
6. For the **Outgoing model**, select **Explicit**. In the **Explicit outgoing model** field, enter `Qwen/Qwen3-32B`. Replace the model with the model that your backend serves.
7. The form has no field for `params.baseUrl`. Click the **Raw** icon (`<>`) in the drawer header, and add `baseUrl: "http://localhost:8000/v1"` under `params`. Replace the URL with your OpenAI-compatible provider's endpoint.
8. Click **Save model**.

The UI writes the provider as `openai` instead of `openAI`. Agentgateway accepts both values. If you prefer a form field for the base URL, select the **Custom** provider instead. That provider has a **Base URL** field, and writes a `custom` provider block instead of `openAI`.

Whether the UI can save depends on your storage mode. For more information, see [Save changes from the UI]({{< link-hextra path="/documentation/setup/ui/launch-ui/#save-changes" >}}).
{{% /tab %}}
{{% tab name="Config file" %}}
{{< reuse "agw-docs/pages/agentgateway/integrations/llm-clients/claude-code-openai-config.md" >}}
{{% /tab %}}
{{< /tabs >}}
{{% /version %}}
{{% version include-if="1.0.x,1.1.x,1.2.x,1.3.x,1.4.x,1.5.x,1.6.x,2.2.x" %}}
{{< reuse "agw-docs/pages/agentgateway/integrations/llm-clients/claude-code-openai-config.md" >}}
{{% /version %}}

{{< doc-test paths="claude-code-openai-validate" >}}
agentgateway -f config.yaml --validate-only
{{< /doc-test >}}

### Connect Claude Code {#openai-connect}

1. Configure Claude Code to point to your agentgateway instance.

   ```bash
   export ANTHROPIC_BASE_URL="http://localhost:4000"
   ```

2. Verify the connection.

   ```bash
   claude -p "Hello"
   ```

## Configure agentgateway with Anthropic backend

Alternatively, route Claude Code directly to Anthropic's API through agentgateway. This is useful if you want to leverage Anthropic's latest models or features directly.

### Get an Anthropic API key {#anthropic-api-key}

1. Get an Anthropic API key from the [Anthropic Console](https://platform.claude.com).

2. Export your Anthropic API key.

   ```bash
   export ANTHROPIC_API_KEY="sk-ant-your-key-here"
   ```

### Set up agentgateway {#anthropic-setup}

{{% version exclude-if="1.0.x,1.1.x,1.2.x,1.3.x,1.4.x,1.5.x,1.6.x,2.2.x" %}}
You can configure agentgateway in the UI or in your configuration file.

{{< tabs >}}
{{% tab name="UI" %}}
To create the same configuration in the [UI]({{< link-hextra path="/documentation/setup/ui/launch-ui/" >}}), follow these steps in the terminal where you exported the key.

1. Create a configuration file with an empty `llm` section, and start agentgateway. The UI checks that the `ANTHROPIC_API_KEY` environment variable exists when you save the model.

   ```sh
   cat > config.yaml <<'EOF'
   llm:
     models: []
   EOF
   agentgateway -f config.yaml
   ```

2. Open **LLM** > **Models**, such as [http://localhost:15000/ui/llm/models](http://localhost:15000/ui/llm/models), and click **Add model**.
3. From the **Provider** dropdown, select **Anthropic**.
4. In the **Incoming model match** field, replace the default `anthropic/*` with `*`.
5. For the **Provider API key**, select **Env var**, and enter `ANTHROPIC_API_KEY`.

   {{< reuse-image src="img/ui-llm-add-model-anthropic-wildcard.png" srcDark="img/ui-llm-add-model-anthropic-wildcard-dark.png" alt="Add model drawer with the Anthropic provider selected, * as the incoming model match, and the provider API key read from the ANTHROPIC_API_KEY environment variable" >}}

6. Click **Save model**.

Whether the UI can save depends on your storage mode. For more information, see [Save changes from the UI]({{< link-hextra path="/documentation/setup/ui/launch-ui/#save-changes" >}}).
{{% /tab %}}
{{% tab name="Config file" %}}
{{< reuse "agw-docs/pages/agentgateway/integrations/llm-clients/claude-code-anthropic-config.md" >}}
{{% /tab %}}
{{< /tabs >}}
{{% /version %}}
{{% version include-if="1.0.x,1.1.x,1.2.x,1.3.x,1.4.x,1.5.x,1.6.x,2.2.x" %}}
{{< reuse "agw-docs/pages/agentgateway/integrations/llm-clients/claude-code-anthropic-config.md" >}}
{{% /version %}}

{{< doc-test paths="claude-code-anthropic-validate" >}}
export ANTHROPIC_API_KEY="${ANTHROPIC_API_KEY:-test}"
agentgateway -f config.yaml --validate-only
{{< /doc-test >}}

### Connect Claude Code {#anthropic-connect}

1. Configure Claude Code.

   ```bash
   export ANTHROPIC_BASE_URL="http://localhost:4000"
   ```

2. Verify the connection.

   ```bash
   claude -p "Hello"
   ```

   Example output:

   ```
   Hello! How can I help you today?
   ```

   If you see an error like `API Error: 400 context_management: Extra inputs are not permitted`, Claude Code is sending experimental beta parameters that agentgateway does not yet support. Disable experimental betas and retry the request.

   ```bash
   export CLAUDE_CODE_DISABLE_EXPERIMENTAL_BETAS=1
   claude -p "Hello"
   ```

> [!NOTE]
> For pinned model configuration, extended thinking, and other options, see the [Anthropic provider page]({{< link-hextra path="/integrations/llm/providers/anthropic" >}}).

## Claude Teams or Pro account

If you have a Claude Teams or Pro account, you can use agentgateway for request routing without an API key. Authentication is handled by your Claude subscription via OAuth.

1. Create a configuration file. Agentgateway listens on port `4001` and routes requests to Anthropic.

   ```bash
   cat > config.yaml << 'EOF'
   gateways:
     default:
       port: 4001
       protocol: HTTP
   llm:
     models:
     - name: '*'
       provider: anthropic
   EOF
   ```

2. Start agentgateway.

   ```bash
   agentgateway -f config.yaml
   ```

3. Set the `ANTHROPIC_BASE_URL` environment variable to point Claude Code at the gateway.

   ```bash
   export ANTHROPIC_BASE_URL="http://localhost:4001/"
   ```

4. Verify the connection.

   ```bash
   claude -p "Hello"
   ```

## Next steps

{{< cards >}}
  {{< card path="/integrations/llm/providers/anthropic" title="Anthropic provider" subtitle="Complete Anthropic provider configuration" >}}
  {{< card path="/documentation/llm/prompt-guards/" title="Prompt guards" subtitle="Set up guardrails for LLM requests and responses" >}}
{{< /cards >}}
