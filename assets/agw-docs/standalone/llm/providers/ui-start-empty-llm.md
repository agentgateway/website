Create a configuration file with an empty `llm` section, and start agentgateway in the same terminal. Without an `llm` section, the UI does not show the **LLM** > **Models** page.

```sh
cat > config.yaml <<'EOF'
# yaml-language-server: $schema={{< reuse "agw-docs/snippets/schema.md" >}}
llm:
  models: []
EOF
agentgateway -f config.yaml
```
