1. Create a configuration file with an OpenAI-compatible provider. Use `name: "*"` to accept the model names Claude Code sends. Set `params.model` to replace those names with a model your backend serves.

   ```yaml {paths="claude-code-openai-validate"}
   cat > config.yaml << 'EOF'
   # yaml-language-server: $schema=https://agentgateway.dev/schema/config
   llm:
     models:
     - name: "*"
       provider: openAI
       params:
         model: "Qwen/Qwen3-32B"  # The model that your backend serves
         baseUrl: "http://localhost:8000/v1"  # vLLM or similar OpenAI-compatible endpoint
         apiKey: "mock-key"  # Not used for local providers, but required by config
   EOF
   ```

   Replace `Qwen/Qwen3-32B` with your backend's model name. Set `baseUrl` to your provider's OpenAI-compatible endpoint.

2. Start agentgateway.

   ```bash
   agentgateway -f config.yaml
   ```
