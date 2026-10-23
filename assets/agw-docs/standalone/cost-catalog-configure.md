```yaml
# yaml-language-server: $schema=https://agentgateway.dev/schema/config
config:
  modelCatalog:
  - file: ./costs/catalog.json
llm:
  models:
  - name: "*"
    provider: openAI
    params:
      apiKey: "$OPENAI_API_KEY"
```

Run agentgateway with the config file.

```sh
agentgateway -f config.yaml
```
