1. Create a configuration file with the Anthropic provider. The wildcard `*` model name accepts any model. Claude Code sends the model in each request, so you do not need to pin a specific model.

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

2. Start agentgateway.

   ```bash
   agentgateway -f config.yaml
   ```
