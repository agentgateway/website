Configure the agentgateway binary to route chat completion requests to an LLM provider.

## Before you begin

{{< reuse "agw-docs/standalone/quickstart/install-prereq.md" >}}

{{< doc-test paths="llm" >}}
# For CI/tests: install the agentgateway binary to local bin without sudo.
# Uses the nightly 'latest-dev' image for main and the latest release otherwise,
# so the version dir rotates without hardcoding a release tag that may not exist yet.
{{< reuse "agw-docs/snippets/install-agentgateway-binary.md" >}}
{{< /doc-test >}}

3. Get an API key for the provider that you want to use.

   {{< tabs >}}
   {{% tab name="OpenAI" %}}
   Get an [OpenAI API key](https://platform.openai.com/api-keys).
   {{% /tab %}}
   {{% tab name="Anthropic" %}}
   Get an [Anthropic API key](https://console.anthropic.com/settings/keys).
   {{% /tab %}}
   {{< /tabs >}}

## Steps

Route to an OpenAI or Anthropic backend through agentgateway.

{{< version include-if="1.2.x,1.1.x,1.0.x" >}}
{{% steps %}}

### Step 1: Set your API key

Store your provider API key in an environment variable so agentgateway can authenticate to the API.

{{< tabs >}}
{{% tab name="OpenAI" %}}
```sh
export OPENAI_API_KEY='<your-api-key>'
```
{{% /tab %}}
{{% tab name="Anthropic" %}}
```sh
export ANTHROPIC_API_KEY='<your-api-key>'
```
{{% /tab %}}
{{< /tabs >}}

### Step 2: Create the configuration

Create a `config.yaml` that defines an LLM model. This configuration uses the simplified LLM format to route traffic to the selected provider.

{{< tabs >}}
{{% tab name="OpenAI" %}}
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
{{% /tab %}}
{{% tab name="Anthropic" %}}
```yaml
cat > config.yaml << 'EOF'
# yaml-language-server: $schema=https://agentgateway.dev/schema/config

llm:
  models:
  - name: claude-haiku-4-5
    provider: anthropic
    params:
      model: claude-haiku-4-5
      apiKey: "$ANTHROPIC_API_KEY"
EOF
```
{{% /tab %}}
{{< /tabs >}}

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

{{< tabs >}}
{{% tab name="OpenAI" %}}
```sh {paths="llm"}
curl -s http://localhost:4000/v1/chat/completions \
  -H "Content-Type: application/json" \
  -d '{
    "model": "gpt-3.5-turbo",
    "messages": [{"role": "user", "content": "Say hello in one sentence."}]
  }' | jq .
```
{{% /tab %}}
{{% tab name="Anthropic" %}}
```sh
curl http://localhost:4000/v1/chat/completions \
  -H 'content-type: application/json' \
  -d '{
    "model": "claude-haiku-4-5",
    "messages": [
      {
        "role": "user",
        "content": "Reply with exactly: Anthropic through agentgateway works"
      }
    ]
  }'
```
{{% /tab %}}
{{< /tabs >}}

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
{{% steps %}}

### Step 1: Set your API key

Store your provider API key in an environment variable so agentgateway can authenticate to the API.

{{< tabs >}}
{{% tab name="OpenAI" %}}
```sh
export OPENAI_API_KEY='<your-api-key>'
```
{{% /tab %}}
{{% tab name="Anthropic" %}}
```sh
export ANTHROPIC_API_KEY='<your-api-key>'
```
{{% /tab %}}
{{< /tabs >}}

### Step 2: Start agentgateway

You add the model from the UI in the next steps, so you can start agentgateway without a config file. When you run `agentgateway` without specifying a config, it bootstraps a basic config at `~/.config/agentgateway/config.yaml` and uses it automatically.

```sh
agentgateway
```

Example output:

```
info  app  serving UI at http://localhost:4000/ui
```

{{< doc-test paths="llm" >}}
# Hidden test: the UI steps below (Enable LLM -> Add model) are not scriptable, so this
# block reproduces the equivalent config they produce, to keep the resulting setup tested.
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
agentgateway -f config.yaml &
AGW_PID=$!
trap 'kill $AGW_PID 2>/dev/null' EXIT
sleep 3
{{< /doc-test >}}

### Step 3: Enable LLM

1. Open the [agentgateway UI](http://localhost:4000/ui/). 
2. On the first run, the **Welcome to Agentgateway** wizard opens. Click **Enable LLM**, and then click **Continue**.

   {{< reuse-image-light src="img/ui-welcome-wizard.png" >}}
   {{< reuse-image-dark srcDark="img/ui-welcome-wizard-dark.png" >}}

The **Gateway Overview** home page opens, with rows for **LLM**, **MCP**, and **Traffic**.

### Step 4: Add a model

{{< tabs >}}
{{% tab name="OpenAI" %}}
1. In the **LLM** section of the navigation menu, click **Models**, and then click **Add model**.
2. For the **Incoming model match**, enter the model name that clients send, such as `gpt-3.5-turbo`.
3. From the **Provider** dropdown list, select **OpenAI**.
4. For the **Provider API key**, click **Env var** and enter `OPENAI_API_KEY` (the variable you set in Step 1).
5. Click **Save model**.

{{< reuse-image-light src="img/ui-llm-add-model.png" >}}
{{< reuse-image-dark srcDark="img/ui-llm-add-model-dark.png" >}}
{{% /tab %}}
{{% tab name="Anthropic" %}}
1. In the **LLM** section of the navigation menu, click **Models**, and then click **Add model**.
2. For the **Incoming model match**, enter `claude-haiku-4-5`.
3. From the **Provider** dropdown list, select **Anthropic**.
4. For the **Provider API key**, click **Env var** and enter `ANTHROPIC_API_KEY` (the variable you set in Step 1).
5. Click **Save model**.

{{< reuse-image-light src="img/ui-llm-add-model-anthropic.png" >}}
{{< reuse-image-dark srcDark="img/ui-llm-add-model-anthropic.png" >}}
{{% /tab %}}
{{< /tabs >}}

### Step 5: Send a chat completion request

Send a request from the command line, or try it in the built-in playground.

From another terminal, send a request to the chat completions endpoint:

{{< tabs >}}
{{% tab name="OpenAI" %}}
```sh {paths="llm"}
curl -s http://localhost:4000/v1/chat/completions \
  -H "Content-Type: application/json" \
  -d '{
    "model": "gpt-3.5-turbo",
    "messages": [{"role": "user", "content": "Say hello in one sentence."}]
  }' | jq .
```
{{% /tab %}}
{{% tab name="Anthropic" %}}
```sh
curl http://localhost:4000/v1/chat/completions \
  -H 'content-type: application/json' \
  -d '{
    "model": "claude-haiku-4-5",
    "messages": [
      {
        "role": "user",
        "content": "Reply with exactly: Anthropic through agentgateway works"
      }
    ]
  }'
```
{{% /tab %}}
{{< /tabs >}}

Or open the [LLM playground](http://localhost:4000/ui/llm/playground/), enter a prompt in the **User message** box, and click **Send**.

{{< tabs >}}
{{% tab name="OpenAI" %}}
{{< reuse-image-light src="img/ui-llm-playground.png" >}}
{{< reuse-image-dark srcDark="img/ui-llm-playground-dark.png" >}}
{{% /tab %}}
{{% tab name="Anthropic" %}}
{{< reuse-image-light src="img/ui-llm-playground-anthropic.png" >}}
{{< reuse-image-dark srcDark="img/ui-llm-playground-anthropic.png" >}}
{{% /tab %}}
{{< /tabs >}}
{{% /steps %}}
{{< /version >}}

## Next steps

Check out more guides related to LLM consumption with agentgateway.

{{< cards >}}
  {{< card path="/llm/cost-controls/virtual-keys/" title="Virtual key management" subtitle="Manage API keys and control spending with rate limits for your LLM requests." >}}
  {{< card path="/llm/observability/" title="LLM observability" subtitle="View metrics, traces, and logs for LLM traffic." >}}
  {{< card path="/llm/providers/openai/" title="OpenAI provider reference" subtitle="Optional model override, multiple routes, passthrough, and Codex connection." >}}
{{< /cards >}}
