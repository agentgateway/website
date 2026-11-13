```yaml
cat > /tmp/test-copilot.yaml << 'EOF'
# yaml-language-server: $schema={{< reuse "agw-docs/snippets/schema.md" >}}
llm:
  port: 3000
  models:
  - name: "*"
    provider: openAI
    params:
      apiKey: "$OPENAI_API_KEY"
EOF
```
