Configure the agentgateway binary to route requests to the [OpenAI](https://openai.com/) chat completions API.

## Before you begin

1. [Install the agentgateway binary]({{< link-hextra path="/deployment/binary" >}}).

   {{< tabs >}}
{{% tab name="Latest" %}}

To install the latest release:

```sh
curl -sL https://agentgateway.dev/install | bash
```

{{% /tab %}}
{{% tab name="Specific version" %}}

To install a specific version, pass the `--version` flag. Use any release tag from the [agentgateway releases page](https://github.com/agentgateway/agentgateway/releases), such as `{{< reuse "agw-docs/versions/n-patch.md" >}}`.

```sh
curl -sL https://agentgateway.dev/install | bash -s -- --version {{< reuse "agw-docs/versions/n-patch.md" >}}
```
{{% /tab %}}
{{% tab name="Nightly build" %}}

To install the nightly build for development and testing:

1. Go to the [nightly release in GitHub Actions](https://github.com/agentgateway/agentgateway/actions/workflows/nightly.yml) and click the release that you want to use.
2. From the URL, get the release number, such as `24873456345` in `https://github.com/agentgateway/agentgateway/actions/runs/24873456345`.
3. Using the `gh` CLI, download the release for your OS. The following example uses macOS.

   ```sh
   gh run download 24873456345 -R agentgateway/agentgateway -n release-binary-mac
   ```

4. Make the binary file executable and move it to your binary location, such as in the following example.
   
   ```sh
   chmod +x agentgateway
   sudo mv agentgateway /usr/local/bin/agentgateway
   ```

5. Verify that you have the nightly release.

   ```sh
   agentgateway --version
   ```

   Example output:
   ```json
   {
     "version": "0.0.0-alpha.813d7d0",
     "git_revision": "813d7d0ab4757db7c8ed5a639bc63c0bb20ac116",
     "rust_version": "1.95.0",
     "build_profile": "release",
     "build_target": "aarch64-apple-darwin"
   }
   ```
{{% /tab %}}
   {{< /tabs >}}

{{< doc-test paths="llm" >}}
# For CI/tests: install dev version to local bin without sudo
mkdir -p "$HOME/.local/bin"
export PATH="$HOME/.local/bin:$PATH"
VERSION="v{{< reuse "agw-docs/versions/n-patch.md" >}}"
BINARY_URL="https://github.com/agentgateway/agentgateway/releases/download/${VERSION}/agentgateway-$(uname -s | tr '[:upper:]' '[:lower:]')-$(uname -m | sed 's/x86_64/amd64/')"
curl -sL "$BINARY_URL" -o "$HOME/.local/bin/agentgateway"
chmod +x "$HOME/.local/bin/agentgateway"
{{< /doc-test >}}

2. Get an [OpenAI API key](https://platform.openai.com/api-keys).

## Steps

Route to an OpenAI backend through agentgateway.

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
{{% steps %}}

### Step 1: Set your API key

Store your OpenAI API key in an environment variable so agentgateway can authenticate to the API.

```sh
export OPENAI_API_KEY='<your-api-key>'
```

### Step 2: Start agentgateway

You add the model from the UI in the next steps, so you can start agentgateway without a config file. When you run `agentgateway` without specifying a config, it bootstraps a basic config at `~/.config/agentgateway/config.yaml` and uses it automatically.

```sh
agentgateway
```

Example output:

```
info  app  serving UI at http://localhost:15000/ui
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

1. Open the [agentgateway UI](http://localhost:15000/ui/).
2. On the **Gateway Overview**, find the **LLM** row and click **Enable LLM**.

### Step 4: Add a model

1. In the **LLM** section of the navigation menu, click **Models**, and then click **Add model**.
2. For the **Incoming model match**, enter the model name that clients send, such as `gpt-3.5-turbo`.
3. From the **Provider** list, select **OpenAI**.
4. For the **Provider API key**, click **Env var** and enter `OPENAI_API_KEY` (the variable you set in Step 1).
5. Click **Save model**.

{{< reuse-image-light src="img/ui-llm-add-model.png" >}}
{{< reuse-image-dark srcDark="img/ui-llm-add-model-dark.png" >}}

### Step 5: Send a chat completion request

Send a request from the command line, or try it in the built-in playground.

From another terminal, send a request to the chat completions endpoint:

```sh {paths="llm"}
curl -s http://localhost:4000/v1/chat/completions \
  -H "Content-Type: application/json" \
  -d '{
    "model": "gpt-3.5-turbo",
    "messages": [{"role": "user", "content": "Say hello in one sentence."}]
  }' | jq .
```

Or open the [LLM playground](http://localhost:15000/ui/llm/playground/), enter a prompt in the **User message** box, and click **Send**.

{{< reuse-image-light src="img/ui-llm-playground.png" >}}
{{< reuse-image-dark srcDark="img/ui-llm-playground-dark.png" >}}
{{% /steps %}}
{{< /version >}}

## Next steps

Check out more guides related to LLM consumption with agentgateway.

{{< cards >}}
  {{< card path="/llm/virtual-keys/" title="Virtual key management" subtitle="Manage API keys and control spending with rate limits for your LLM requests." >}}
  {{< card path="/llm/observability/" title="LLM observability" subtitle="View metrics, traces, and logs for LLM traffic." >}}
  {{< card path="/llm/providers/openai/" title="OpenAI provider reference" subtitle="Optional model override, multiple routes, passthrough, and Codex connection." >}}
{{< /cards >}}
