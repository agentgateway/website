```yaml
llm:
  models:
  - name: "gpt-*"
    provider: openAI
    params:
      apiKey: "$OPENAI_API_KEY"
  - name: "claude-*"
    provider: anthropic
    params:
      apiKey: "$ANTHROPIC_API_KEY"
```
