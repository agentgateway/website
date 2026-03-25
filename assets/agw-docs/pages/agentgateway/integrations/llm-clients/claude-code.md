Configure [Claude Code](https://docs.anthropic.com/en/docs/claude-code), the AI coding CLI by Anthropic, to route LLM requests through your agentgateway proxy.

## About

Claude Code uses Anthropic's native `/v1/messages` endpoint instead of the OpenAI-compatible `/v1/chat/completions` endpoint that other LLM clients use. When you configure the `anthropic` provider, agentgateway automatically handles this format and applies policies such as prompt guards, rate limiting, and observability.

## Before you begin

- Agentgateway running at `http://localhost:4000` with a configured Anthropic backend. For setup instructions, see the [Anthropic provider page]({{< link-hextra path="/llm/providers/anthropic" >}}).
- [Claude Code CLI](https://docs.anthropic.com/en/docs/claude-code) installed (`npm install -g @anthropic-ai/claude-code`).
- An Anthropic API key from the [Anthropic Console](https://console.anthropic.com).

## Configure agentgateway

Start agentgateway with an Anthropic backend configuration.

1. Export your Anthropic API key.

   ```bash
   export ANTHROPIC_API_KEY="sk-ant-your-key-here"
   ```

2. Create a configuration file with the Anthropic provider.

   ```yaml {paths="claude-code-validate"}
   cat > /tmp/test-claude-code.yaml << 'EOF'
   # yaml-language-server: $schema=https://agentgateway.dev/schema/config
   llm:
     models:
     - name: "*"
       provider: anthropic
       params:
         apiKey: "$ANTHROPIC_API_KEY"
   EOF
   ```

   {{< doc-test paths="claude-code-validate" >}}
   export ANTHROPIC_API_KEY="${ANTHROPIC_API_KEY:-test}"
   agentgateway -f /tmp/test-claude-code.yaml --validate-only
   {{< /doc-test >}}

   The wildcard `*` model name accepts any model. Claude Code sends the model in each request, so you do not need to pin a specific model.

3. Start agentgateway.

   ```bash
   agentgateway -f config.yaml
   ```

{{< callout type="info" >}}
For pinned model configuration, extended thinking, and other options, see the [Anthropic provider page]({{< link-hextra path="/llm/providers/anthropic" >}}).
{{< /callout >}}

## Configure Claude Code

Set the `ANTHROPIC_BASE_URL` environment variable to point Claude Code at your agentgateway instance.

```bash
export ANTHROPIC_BASE_URL="http://localhost:4000"
```

{{< callout type="info" >}}
You do not need to provide the Anthropic API key to Claude Code. The credentials are configured in agentgateway. Claude Code only needs `ANTHROPIC_BASE_URL` to redirect its traffic.
{{< /callout >}}

## Verify the connection

1. Send a single test prompt through agentgateway.

   ```bash
   claude -p "Hello"
   ```

2. Verify the request appears in the agentgateway logs.

   Example output:

   ```
   info  request gateway=default/default listener=llm route=internal/model:* endpoint=api.anthropic.com:443 http.method=POST http.path=/v1/messages http.status=200 protocol=llm gen_ai.operation.name=chat gen_ai.provider.name=anthropic gen_ai.request.model=claude-haiku-4-5-20251001 gen_ai.usage.input_tokens=14 gen_ai.usage.output_tokens=9 gen_ai.request.max_tokens=50 duration=1687ms
   ```

3. Optionally, start Claude Code in interactive mode with all traffic routed through agentgateway.

   ```bash
   claude
   ```

   Every request, including prompts, tool calls, and file reads, flows through agentgateway.
