1. Create a configuration file with an OpenAI-compatible provider. The wildcard `*` model name accepts any model. Claude Code sends the model in each request, so you do not need to pin a specific model.

   ```yaml {paths="claude-code-openai-validate"}
   cat > config.yaml << 'EOF'
   # yaml-language-server: $schema=https://agentgateway.dev/schema/config
   llm:
     models:
     - name: "*"
       provider: openAI
       params:
         baseUrl: "http://localhost:8000/v1"  # vLLM or similar OpenAI-compatible endpoint
         apiKey: "mock-key"  # Not used for local providers, but required by config
   EOF
   ```

   Replace `http://localhost:8000/v1` with your OpenAI-compatible provider's endpoint.

2. Start agentgateway.

   ```bash
   agentgateway -f config.yaml
   ```
