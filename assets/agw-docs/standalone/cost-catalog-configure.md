```yaml
# yaml-language-server: $schema={{< reuse "agw-docs/snippets/schema.md" >}}
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
