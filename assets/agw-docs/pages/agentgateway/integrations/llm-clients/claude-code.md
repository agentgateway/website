Configure [Claude Code](https://code.claude.com/docs), the AI coding CLI by Anthropic, to route LLM requests through your agentgateway proxy.

## Before you begin

1. {{< reuse "agw-docs/snippets/prereq-agentgateway.md" >}}
2. Install the [Claude Code CLI](https://code.claude.com/docs) (`npm install -g @anthropic-ai/claude-code`).
3. Get an Anthropic API key from the [Anthropic Console](https://platform.claude.com).

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
   mkdir -p "$HOME/.local/bin"
   export PATH="$HOME/.local/bin:$PATH"
   VERSION="v{{< reuse "agw-docs/versions/n-patch.md" >}}"
   BINARY_URL="https://github.com/agentgateway/agentgateway/releases/download/${VERSION}/agentgateway-$(uname -s | tr '[:upper:]' '[:lower:]')-$(uname -m | sed 's/x86_64/amd64/')"
   curl -sL "$BINARY_URL" -o "$HOME/.local/bin/agentgateway"
   chmod +x "$HOME/.local/bin/agentgateway"
   export ANTHROPIC_API_KEY="${ANTHROPIC_API_KEY:-test}"
   agentgateway -f config.yaml --validate-only
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

   All requests, including prompts, tool calls, and file reads, flow through agentgateway.

## Teams account

If you have a Claude Teams or Pro account, use this configuration instead of the API key setup above. No API key is required — authentication is handled by your Claude subscription via OAuth.

1. Create a configuration file. Agentgateway listens on port `4001` and exposes Claude at the `/claude` path.

   ```yaml
   cat > config.yaml << 'EOF'
   binds:
   - port: 4001
     listeners:
     - name: default
       protocol: HTTP
       routes:
       - name: claude-agent
         matches:
         - path:
             pathPrefix: /claude
         policies:
           urlRewrite:
             path:
               prefix: /
         backends:
         - ai:
             name: claude-agent
             provider:
               anthropic: {}
             policies:
               ai:
                 routes:
                   /v1/messages: messages
                   /v1/messages/count_tokens: anthropicTokenCount
                   '*': passthrough
   EOF
   ```

2. Start agentgateway.

   ```bash
   agentgateway -f config.yaml
   ```

3. Point Claude Code at the `/claude` path by adding the following to `~/.claude/settings.local.json`:

   ```json
   {
     "env": {
       "ANTHROPIC_BASE_URL": "http://localhost:4001/claude"
     }
   }
   ```

4. Verify the connection.

   ```bash
   claude -p "Hello"
   ```

## Next steps

{{< cards >}}
  {{< card path="/llm/providers/anthropic" title="Anthropic provider" subtitle="Complete Anthropic provider configuration" >}}
  {{< card path="/llm/prompt-guards/" title="Prompt guards" subtitle="Set up guardails for LLM requests and responses" >}}
{{< /cards >}}
