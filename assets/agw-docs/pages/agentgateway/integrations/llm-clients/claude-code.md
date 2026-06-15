Configure [Claude Code](https://code.claude.com/docs), the AI coding CLI by Anthropic, to route LLM requests through your agentgateway proxy.

The primary use case is routing Claude Code to non-Anthropic LLM backends (such as vLLM, Ollama, or any OpenAI-compatible provider) for cost optimization and flexibility. You can also configure direct routing to Anthropic or use a Claude Teams account as alternative options.

## Before you begin

1. {{< reuse "agw-docs/snippets/prereq-agentgateway.md" >}}
2. Install the [Claude Code CLI](https://code.claude.com/docs) (`npm install -g @anthropic-ai/claude-code`).

## Configure agentgateway with OpenAI-compatible backend

Route Claude Code to any OpenAI-compatible LLM provider (e.g., vLLM, Ollama, or local language models). This is the recommended approach for cost-effective and flexible deployment.

1. Create a configuration file with an OpenAI-compatible provider. The wildcard `*` model name accepts any model. Claude Code sends the model in each request, so you do not need to pin a specific model.

   ```yaml {paths="claude-code-openai-validate"}
   cat > config.yaml << 'EOF'
   # yaml-language-server: $schema=https://agentgateway.dev/schema/config
   llm:
     models:
     - name: "*"
       provider: openAI
       params:
         baseURL: "http://localhost:8000/v1"  # vLLM or similar OpenAI-compatible endpoint
         apiKey: "mock-key"  # Not used for local providers, but required by config
   EOF
   ```

   Replace `http://localhost:8000/v1` with your OpenAI-compatible provider's endpoint.

   {{< doc-test paths="claude-code-openai-validate" >}}
   agentgateway -f config.yaml --validate-only
   {{< /doc-test >}}

2. Start agentgateway.

   ```bash
   agentgateway -f config.yaml
   ```

3. Configure Claude Code to point to your agentgateway instance.

   ```bash
   export ANTHROPIC_BASE_URL="http://localhost:4000"
   ```

4. Verify the connection.

   ```bash
   claude -p "Hello"
   ```

## About CLAUDE_CODE_DISABLE_EXPERIMENTAL_BETAS

The `CLAUDE_CODE_DISABLE_EXPERIMENTAL_BETAS` environment variable disables Claude Code's experimental beta features. You typically **do not need** this variable when proxying to non-Anthropic backends or standard Anthropic routing.

Only set this variable if you encounter errors like `Extra inputs are not permitted` when using advanced Anthropic features (e.g., experimental translation or extended thinking). If you use a non-Anthropic backend, this variable can be safely omitted.

## Configure agentgateway with Anthropic backend

Alternatively, route Claude Code directly to Anthropic's API through agentgateway. This is useful if you want to leverage Anthropic's latest models or features directly.

1. Get an Anthropic API key from the [Anthropic Console](https://platform.claude.com).

2. Export your Anthropic API key.

   ```bash
   export ANTHROPIC_API_KEY="sk-ant-your-key-here"
   ```

3. Create a configuration file with the Anthropic provider. The wildcard `*` model name accepts any model. Claude Code sends the model in each request, so you do not need to pin a specific model.

   ```yaml {paths="claude-code-anthropic-validate"}
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

   {{< doc-test paths="claude-code-anthropic-validate" >}}
   export ANTHROPIC_API_KEY="${ANTHROPIC_API_KEY:-test}"
   agentgateway -f config.yaml --validate-only
   {{< /doc-test >}}

4. Start agentgateway.

   ```bash
   agentgateway -f config.yaml
   ```

5. Configure Claude Code.

   ```bash
   export ANTHROPIC_BASE_URL="http://localhost:4000"
   ```

6. Verify the connection.

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

{{< callout type="info" >}}
For pinned model configuration, extended thinking, and other options, see the [Anthropic provider page]({{< link-hextra path="/llm/providers/anthropic" >}}).
{{< /callout >}}

## Claude Teams or Pro account

If you have a Claude Teams or Pro account, you can use agentgateway for request routing without an API key. Authentication is handled by your Claude subscription via OAuth.

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

3. Set the `ANTHROPIC_BASE_URL` environment variable to point Claude Code at the `/claude` path.

   ```bash
   export ANTHROPIC_BASE_URL="http://localhost:4001/claude"
   ```

4. Verify the connection.

   ```bash
   claude -p "Hello"
   ```

## Next steps

{{< cards >}}
  {{< card path="/llm/providers/anthropic" title="Anthropic provider" subtitle="Complete Anthropic provider configuration" >}}
  {{< card path="/llm/prompt-guards/" title="Prompt guards" subtitle="Set up guardrails for LLM requests and responses" >}}
{{< /cards >}}
