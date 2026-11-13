```yaml
llm:
  models:
  - name: gpt-5.6-luna
    provider: openAI
    params:
      apiKey: "$OPENAI_API_KEY"
  - name: claude-sonnet-4-5
    provider: anthropic
    params:
      apiKey: "$ANTHROPIC_API_KEY"
```
