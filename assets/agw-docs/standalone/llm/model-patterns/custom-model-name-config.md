```yaml
llm:
  models:
  - name: fast
    provider: openAI
    params:
      model: gpt-5-mini
      apiKey: "$OPENAI_API_KEY"
  - name: support-bot
    provider: anthropic
    params:
      model: claude-haiku-4-5
      apiKey: "$ANTHROPIC_API_KEY"
```
