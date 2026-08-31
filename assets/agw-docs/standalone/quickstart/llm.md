Configure the agentgateway binary to route chat completion requests to an LLM provider.

## Before you begin

{{< reuse "agw-docs/standalone/quickstart/install-prereq.md" >}}

{{< doc-test paths="llm" >}}
# For CI/tests: install the agentgateway binary to local bin without sudo.
# Uses the nightly 'latest-dev' image for main and the latest release otherwise,
# so the version dir rotates without hardcoding a release tag that may not exist yet.
{{< reuse "agw-docs/snippets/install-agentgateway-binary.md" >}}
{{< /doc-test >}}

3. Get credentials for the provider that you want to use. The steps below cover API keys, cloud credentials, GitHub Copilot, custom providers, and local Ollama models.

## Steps

Route to an LLM provider through agentgateway.

{{< version include-if="1.2.x,1.1.x,1.0.x" >}}
{{% steps %}}

### Step 1: Set your API key

Store your OpenAI API key in an environment variable so agentgateway can authenticate to the API.

```sh
export OPENAI_API_KEY='<your-api-key>'
```

### Step 2: Create the configuration

Create a `config.yaml` that defines an LLM model for OpenAI. This configuration uses the simplified LLM format to route traffic to the OpenAI backend.

```yaml {paths="llm"}
cat > config.yaml << 'EOF'
# yaml-language-server: $schema=https://agentgateway.dev/schema/config

llm:
  models:
  - name: gpt-3.5-turbo
    provider: openAI
    params:
      model: gpt-3.5-turbo
      apiKey: "$OPENAI_API_KEY"
EOF
```

### Step 3: Start agentgateway

Run agentgateway with the config file.

```sh
agentgateway -f config.yaml
```

{{< doc-test paths="llm" >}}
agentgateway -f config.yaml &
AGW_PID=$!
trap 'kill $AGW_PID 2>/dev/null' EXIT
sleep 3
{{< /doc-test >}}

Example output:

```
info  state_manager  loaded config from File("config.yaml")
info  app            serving UI at http://localhost:15000/ui
info  proxy::gateway started bind  bind="bind/4000"
```

### Step 4: Send a chat completion request

From another terminal, send a request to the chat completions endpoint.

```sh {paths="llm"}
curl -s http://localhost:4000/v1/chat/completions \
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
{{< /version >}}

{{< version exclude-if="1.2.x,1.1.x,1.0.x" >}}
{{< reuse "agw-docs/standalone/quickstart/llm-ui-providers.md" >}}
{{< /version >}}

## Next steps

Check out more guides related to LLM consumption with agentgateway.

{{< cards >}}
  {{< card path="/documentation/llm/cost-controls/virtual-keys/" title="Virtual key management" subtitle="Manage API keys and control spending with rate limits for your LLM requests." >}}
  {{< card path="/documentation/llm/observability/" title="LLM observability" subtitle="View metrics, traces, and logs for LLM traffic." >}}
  {{< card path="/documentation/llm/providers/" title="Provider reference" subtitle="Configure authentication and provider-specific options for supported LLM providers." >}}
{{< /cards >}}
