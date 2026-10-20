---
title: Chatbot UI
description: Front Chatbot UI with agentgateway to keep API keys server-side and audit every chat.
---

[Chatbot UI](https://github.com/mckaywrigley/chatbot-ui) is an open-source ChatGPT-style interface by Mckay Wrigley. Because it speaks the OpenAI Chat Completions API, you can point it at agentgateway instead of directly at OpenAI to centralize credentials, apply policies, and capture audit logs.

## What you get

- Browser users no longer hold the OpenAI API key — agentgateway does.
- A consistent place to apply [rate limits]({{< link-hextra path="/documentation/llm/cost-controls/virtual-keys/" >}}) and capture [observability data]({{< link-hextra path="/documentation/llm/observability/" >}}).
- The same gateway can later front additional providers without changing Chatbot UI.

## Architecture

```
┌─────────────────┐     ┌─────────────────┐     ┌─────────────────┐
│   Chatbot UI    │────▶│   agentgateway  │────▶│     OpenAI      │
│   (port 3000)   │     │   (port 3001)   │     │                 │
└─────────────────┘     └─────────────────┘     └─────────────────┘
```

## Before you begin

1. [Install the agentgateway binary]({{< link-hextra path="/documentation/setup/install/binary/" >}}).
2. Get an API key for your LLM provider (e.g. [OpenAI](https://platform.openai.com/api-keys)).
3. Clone or run [Chatbot UI](https://github.com/mckaywrigley/chatbot-ui). Note that recent versions of Chatbot UI require a Supabase backend; see the upstream README for the full setup.

## Steps

{{% steps %}}

### Step 1: Configure agentgateway

You can configure agentgateway in the UI or in your configuration file.

{{< tabs >}}
{{% tab name="UI" %}}
To create the same configuration in the [UI]({{< link-hextra path="/documentation/setup/ui/launch-ui/" >}}), follow these steps.

1. Set your OpenAI API key, create a configuration file with an empty `llm` section, and start agentgateway. The UI checks that the `OPENAI_API_KEY` environment variable exists when you save the model.

   ```sh
   export OPENAI_API_KEY='<your-api-key>'
   cat > config.yaml <<'EOF'
   llm:
     models: []
   EOF
   agentgateway -f config.yaml
   ```

2. Add the model.
   1. Open **LLM** > **Models**, such as [http://localhost:15000/ui/llm/models](http://localhost:15000/ui/llm/models), and click **Add model**.
   2. From the **Provider** dropdown, select **OpenAI**.
   3. In the **Incoming model match** field, replace the default `openai/*` with `*`.
   4. For the **Provider API key**, select **Env var**, and enter `OPENAI_API_KEY`.

      {{< reuse-image src="img/ui-llm-add-model.png" srcDark="img/ui-llm-add-model-dark.png" >}}

   5. Click **Save model**.
3. Serve LLM traffic on port `3001`.
   1. Open the **Gateway Overview** page, such as [http://localhost:15000/ui/](http://localhost:15000/ui/).
   2. On the **LLM** card, click **Settings**.
   3. Enter `3001` for the **Port**, and click **Save settings**.

The UI writes the same deprecated `llm.port` field as the **Config file** tab, plus an empty `llm.gateways` list. If your configuration defines `gateways`, the **Settings** drawer shows a **Gateway** dropdown instead of **Port**, and binds LLM traffic to the gateway that you select. The UI also writes the provider as `openai` instead of `openAI`. Agentgateway accepts both values.

Whether the UI can save depends on your storage mode. For more information, see [Save changes from the UI]({{< link-hextra path="/documentation/setup/ui/launch-ui/#save-changes" >}}).

Agentgateway is already running with the new configuration, so skip Step 2.
{{% /tab %}}
{{% tab name="Config file" %}}
Create a `config.yaml`. Agentgateway listens on port `3001` so it does not conflict with Chatbot UI's default port `3000`:

```yaml
# yaml-language-server: $schema=https://agentgateway.dev/schema/config
llm:
  port: 3001
  models:
  - name: "*"
    provider: openAI
    params:
      apiKey: "$OPENAI_API_KEY"
```
{{% /tab %}}
{{< /tabs >}}

### Step 2: Start agentgateway

```sh
export OPENAI_API_KEY='<your-api-key>'
agentgateway -f config.yaml
```

### Step 3: Point Chatbot UI at agentgateway

Set Chatbot UI's environment variables in its `.env.local` so that requests target the gateway instead of OpenAI directly.

```sh
OPENAI_API_HOST=http://localhost:3001
OPENAI_API_KEY=placeholder
```

The following table describes each environment variable:

| Variable | Description |
|---|---|
| `OPENAI_API_HOST` | The base URL of the agentgateway proxy. |
| `OPENAI_API_KEY` | Must be non-empty for Chatbot UI to start, but it is not used to call OpenAI — agentgateway holds the real key. |

> [!NOTE]
> If you run Chatbot UI via Docker, replace `localhost` with `host.docker.internal` so the container can reach agentgateway on your host machine:
>
> ```sh
> docker run --rm -p 3000:3000 \
>   --add-host=host.docker.internal:host-gateway \
>   -e OPENAI_API_KEY=placeholder \
>   -e OPENAI_API_HOST=http://host.docker.internal:3001 \
>   ghcr.io/mckaywrigley/chatbot-ui:main
> ```
>
> The `--add-host` flag ensures `host.docker.internal` resolves correctly on Linux.

If you are running a Supabase-backed build of Chatbot UI, the equivalent variable is the OpenAI base URL field in the user **Settings** screen; set it to `http://localhost:3001/v1`.

### Step 4: Send a message

Open `http://localhost:3000` in your browser. Send a chat. Confirm in the agentgateway logs that the request was proxied to your LLM provider. You should see a log entry similar to:

```
info  request gateway=default/default listener=llm route=internal/model:* endpoint=api.openai.com:443 http.method=POST http.path=/v1/chat/completions http.status=200 protocol=llm gen_ai.operation.name=chat gen_ai.provider.name=openai gen_ai.request.model=gpt-4o gen_ai.usage.input_tokens=4419 gen_ai.usage.output_tokens=10 duration=2195ms
```

{{% /steps %}}

## Next steps

{{< cards >}}
  {{< card path="/documentation/llm/cost-controls/virtual-keys/" title="Virtual key management" subtitle="Apply rate limits and token budgets to LLM traffic." >}}
  {{< card path="/documentation/llm/observability/" title="LLM observability" subtitle="Metrics, traces, and access logs for every LLM call." >}}
  {{< card path="/integrations/auth/" title="Add authentication" subtitle="Require JWTs from your IdP before calls reach the LLM." >}}
{{< /cards >}}
