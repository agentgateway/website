Configure [Claude Code](https://docs.anthropic.com/en/docs/claude-code), the AI coding CLI by Anthropic, to route LLM requests through your agentgateway proxy.

## Before you begin

1. Install the [Claude Code CLI](https://docs.anthropic.com/en/docs/claude-code) (`npm install -g @anthropic-ai/claude-code`).
2. Get an Anthropic API key from the [Anthropic Console](https://console.anthropic.com).

## Configure agentgateway

Start agentgateway with an Anthropic backend configuration.

1. Export your Anthropic API key.

   ```bash
   export ANTHROPIC_API_KEY="sk-ant-your-key-here"
   ```

2. Create a configuration file with the Anthropic provider. The wildcard `*` model name accepts any model. Claude Code sends the model in each request, so you do not need to pin a specific model.

   ```yaml {paths="claude-code-validate"}
   cat > config.yaml << 'EOF'
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

## Verify the connection

1. Send a single test prompt through agentgateway.

   ```bash
   claude -p "Hello"
   ```

   Example output:
   
   ```
   Hello! How can I help you today?
   ```

2. Verify that the request appears in the agentgateway logs.

   Example output:

   ```
   info  request gateway=default/default listener=llm route=internal/model:* endpoint=api.anthropic.com:443 http.method=POST http.path=/v1/messages http.status=200 protocol=llm gen_ai.operation.name=chat gen_ai.provider.name=anthropic gen_ai.request.model=claude-haiku-4-5-20251001 gen_ai.usage.input_tokens=14 gen_ai.usage.output_tokens=9 gen_ai.request.max_tokens=50 duration=1687ms
   ```

   If you see an error like `API Error: 400 context_management: Extra inputs are not permitted`, Claude Code is sending experimental beta parameters that agentgateway does not yet support. Disable experimental betas and retry the request.

   ```bash
   export CLAUDE_CODE_DISABLE_EXPERIMENTAL_BETAS=1
   claude -p "Hello"
   ```

3. Optionally, start Claude Code in interactive mode with all traffic routed through agentgateway.

   ```bash
   claude
   ```

   Every request, including prompts, tool calls, and file reads, flows through agentgateway.
