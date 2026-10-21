Create a configuration file with an empty `llm` section, and start agentgateway in the same terminal. Without an `llm` section, the UI does not show the **LLM** > **Models** page.

```sh
cat > config.yaml <<'EOF'
# yaml-language-server: $schema=https://agentgateway.dev/schema/config
llm:
  models: []
EOF
agentgateway -f config.yaml
```
