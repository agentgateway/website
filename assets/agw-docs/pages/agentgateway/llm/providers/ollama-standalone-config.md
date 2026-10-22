Create a configuration file that routes requests to your local Ollama instance.

```yaml
# yaml-language-server: $schema=https://agentgateway.dev/schema/config
llm:
  port: 3000
  models:
  - name: "ollama/*"
    provider: ollama
    params:
      model: llama3.2
```

{{% reuse "agw-docs/snippets/review-table.md" %}}

| Setting | Description |
|---------|-------------|
| `provider: ollama` | Uses the built-in Ollama provider shortcut instead of the older `openAI` compatibility path. |
| `params.model` | Sets the default Ollama model. The model must already exist in your local Ollama instance. |
| `params.baseUrl` | Optional override for non-default Ollama endpoints. If omitted, agentgateway uses `http://localhost:11434/v1`. |
| `name: "ollama/*"` | Matches any requested model name that starts with `ollama/`, such as `ollama/llama3.2`. |

If Ollama is running somewhere other than `http://localhost:11434/v1`, override the base URL instead of using host overrides.

```yaml
# yaml-language-server: $schema=https://agentgateway.dev/schema/config
llm:
  port: 3000
  models:
  - name: "ollama/*"
    provider: ollama
    params:
      model: llama3.2
      baseUrl: http://192.168.1.20:11434/v1
```

Start agentgateway:

```sh
agentgateway -f config.yaml
```
