Configure the agentgateway binary to route requests to the [OpenAI](https://openai.com/) chat completions API.

## Before you begin

1. [Install the agentgateway binary]({{< link-hextra path="/deployment/binary" >}}).
   
   ```sh
   curl -sL https://agentgateway.dev/install | bash
   ```

2. Get an [OpenAI API key](https://platform.openai.com/api-keys).

## Steps

Route to an OpenAI backend through agentgateway.

{{% steps %}}

### Step 1: Set your API key

Store your OpenAI API key in an environment variable so agentgateway can authenticate to the API.

```sh
export OPENAI_API_KEY=<your-api-key>
```

### Step 2: Create the configuration

Create a `config.yaml` that defines an HTTP listener and an AI backend for OpenAI. This configuration listens on port 3000, routes traffic to the OpenAI backend, and attaches your API key to outgoing requests via the `backendAuth` policy.

```yaml
cat > config.yaml << 'EOF'
# yaml-language-server: $schema=https://agentgateway.dev/schema/config
binds:
- port: 3000
  listeners:
  - protocol: HTTP
    routes:
    - backends:
      - ai:
          name: openai
          provider:
            openAI:
              model: gpt-3.5-turbo
      policies:
        backendAuth:
          key: "$OPENAI_API_KEY"
EOF
```

### Step 3: Start agentgateway

Run agentgateway with the config file.

```sh
agentgateway -f config.yaml
```

Example output:

```
info  state_manager  loaded config from File("config.yaml")
info  app            serving UI at http://localhost:15000/ui
info  proxy::gateway started bind  bind="bind/3000"
```

### Step 4: Send a chat completion request

From another terminal, send a request to the chat completions endpoint.

```sh
curl -s http://localhost:3000/v1/chat/completions \
  -H "Content-Type: application/json" \
  -d '{
    "model": "gpt-3.5-turbo",
    "messages": [{"role": "user", "content": "Say hello in one sentence."}]
  }' | jq .
```

Example output (abbreviated):

```json
{
  "choices": [
    {
      "message": {
        "role": "assistant",
        "content": "Hello! How can I help you today?"
      }
    }
  ]
}
```

{{% /steps %}}

## Next steps

Check out more guides related to LLM consumption with agentgateway.

{{< cards >}}
  {{< card link="../../llm/providers/openai" title="OpenAI provider reference" subtitle="Optional model override, multiple routes, passthrough, and Codex connection." >}}
  {{< card link="../../llm/api-keys" title="Manage API keys for LLM providers" subtitle="Other ways to supply API keys, such as a Kubernetes Secret." >}}
  {{< card link="../../llm/providers/multiple-llms" title="Multiple LLM providers" subtitle="Route to several LLMs from one agentgateway." >}}
{{< /cards >}}
