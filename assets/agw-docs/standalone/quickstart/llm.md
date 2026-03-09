Configure the agentgateway binary to route requests to the [OpenAI](https://openai.com/) chat completions API.

## Before you begin

1. [Install the agentgateway binary]({{< link-hextra path="/deployment/binary" >}}).

   {{< tabs items="Latest,Specific version" tabTotal="2">}}
{{% tab tabName="Latest" %}}

To install the latest release:

```sh
curl -sL https://agentgateway.dev/install | bash
```

{{% /tab %}}
{{% tab tabName="Specific version" %}}

To install a specific version, such as the development version `{{< reuse "agw-docs/versions/patch-dev.md" >}}`, include the `--version` flag:

```sh
curl -sL https://agentgateway.dev/install | bash -s -- --version {{< reuse "agw-docs/versions/patch-dev.md" >}}
```
{{% /tab %}}
   {{< /tabs >}}

{{< doc-test paths="llm" >}}
# For CI/tests: install dev version to local bin without sudo
mkdir -p "$HOME/.local/bin"
export PATH="$HOME/.local/bin:$PATH"
VERSION="v{{< reuse "agw-docs/versions/patch-dev.md" >}}"
BINARY_URL="https://github.com/agentgateway/agentgateway/releases/download/${VERSION}/agentgateway-$(uname -s | tr '[:upper:]' '[:lower:]')-$(uname -m | sed 's/x86_64/amd64/')"
curl -sL "$BINARY_URL" -o "$HOME/.local/bin/agentgateway"
chmod +x "$HOME/.local/bin/agentgateway"
{{< /doc-test >}}

2. Get an [OpenAI API key](https://platform.openai.com/api-keys).

## Steps

Route to an OpenAI backend through agentgateway.

{{% steps %}}

### Step 1: Set your API key

Store your OpenAI API key in an environment variable so agentgateway can authenticate to the API.

```sh {paths="llm"}
export OPENAI_API_KEY="${OPENAI_API_KEY:-<your-api-key>}"
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

## Next steps

Check out more guides related to LLM consumption with agentgateway.

{{< cards >}}
  {{< card link="../../llm/configuration-modes/" title="Configuration modes" subtitle="Learn about simplified LLM vs traditional HTTP routing configuration." >}}
  {{< card link="../../llm/spending/" title="Control spending" subtitle="Control spending by setting rate limits for your LLM requests." >}}
  {{< card link="../../llm/observability/" title="LLM observability" subtitle="View metrics, traces, and logs for LLM traffic." >}}
{{< /cards >}}
