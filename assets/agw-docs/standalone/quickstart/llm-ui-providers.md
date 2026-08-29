{{% steps %}}

### Step 1: Set up provider credentials

Set up credentials for the provider that you want to use. For production credential options, see the [provider reference]({{< link-hextra path="/llm/providers/" >}}).

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
{{% tab name="Gemini" %}}
```sh
export GEMINI_API_KEY='<your-api-key>'
```
{{% /tab %}}
{{% tab name="Vertex AI" %}}
Authenticate with Google Application Default Credentials:

```sh
gcloud auth application-default login
```
{{% /tab %}}
{{% tab name="Amazon Bedrock" %}}
Configure ambient AWS credentials:

```sh
aws configure
```
{{% /tab %}}
{{% tab name="Azure" %}}
```sh
export AZURE_API_KEY='<your-api-key>'
```
{{% /tab %}}
{{% tab name="GitHub Copilot" %}}
```sh
export GH_COPILOT_TOKEN='<your-token>'
```
{{% /tab %}}
{{% tab name="Custom" %}}
```sh
export CUSTOM_PROVIDER_API_KEY='<your-api-key>'
```
{{% /tab %}}
{{% tab name="Baseten" %}}
```sh
export BASETEN_API_KEY='<your-api-key>'
```
{{% /tab %}}
{{% tab name="Cerebras" %}}
```sh
export CEREBRAS_API_KEY='<your-api-key>'
```
{{% /tab %}}
{{% tab name="Cohere" %}}
```sh
export COHERE_API_KEY='<your-api-key>'
```
{{% /tab %}}
{{% tab name="DeepInfra" %}}
```sh
export DEEPINFRA_API_KEY='<your-api-key>'
```
{{% /tab %}}
{{% tab name="DeepSeek" %}}
```sh
export DEEPSEEK_API_KEY='<your-api-key>'
```
{{% /tab %}}
{{% tab name="Fireworks AI" %}}
```sh
export FIREWORKS_API_KEY='<your-api-key>'
```
{{% /tab %}}
{{% tab name="Groq" %}}
```sh
export GROQ_API_KEY='<your-api-key>'
```
{{% /tab %}}
{{% tab name="Hugging Face" %}}
```sh
export HUGGINGFACE_API_KEY='<your-api-key>'
```
{{% /tab %}}
{{% tab name="Mistral AI" %}}
```sh
export MISTRAL_API_KEY='<your-api-key>'
```
{{% /tab %}}
{{% tab name="Ollama" %}}
Ollama does not require an API key. Make sure that Ollama is running:

```sh
ollama serve
```
{{% /tab %}}
{{% tab name="OpenRouter" %}}
```sh
export OPENROUTER_API_KEY='<your-api-key>'
```
{{% /tab %}}
{{% tab name="Together AI" %}}
```sh
export TOGETHER_API_KEY='<your-api-key>'
```
{{% /tab %}}
{{% tab name="xAI" %}}
```sh
export XAI_API_KEY='<your-api-key>'
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

In the **LLM** section of the navigation menu, click **Models**, and then click **Add model**. Follow the tab for your provider.

{{< tabs >}}
{{% tab name="OpenAI" %}}
1. For **Incoming model match**, enter `gpt-3.5-turbo`.
2. From **Provider**, select **OpenAI**.
3. For **Provider API key**, select **Env var** and enter `OPENAI_API_KEY`.
4. Click **Save model**.

{{< reuse-image-light src="img/ui-llm-add-model.png" >}}
{{< reuse-image-dark srcDark="img/ui-llm-add-model-dark.png" >}}
{{% /tab %}}
{{% tab name="Anthropic" %}}
1. For **Incoming model match**, enter `claude-haiku-4-5`.
2. From **Provider**, select **Anthropic**.
3. For **Provider API key**, select **Env var** and enter `ANTHROPIC_API_KEY`.
4. Click **Save model**.

{{< reuse-image-light src="img/ui-llm-add-model-anthropic.png" >}}
{{< reuse-image-dark srcDark="img/ui-llm-add-model-anthropic.png" >}}
{{% /tab %}}
{{% tab name="Gemini" %}}
1. For **Incoming model match**, enter `gemini-2.5-flash`.
2. From **Provider**, select **Gemini**.
3. For **Provider API key**, select **Env var** and enter `GEMINI_API_KEY`.
4. Click **Save model**.

{{< reuse-image-light src="img/ui-llm-add-model-gemini.png" >}}
{{< reuse-image-dark srcDark="img/ui-llm-add-model-gemini.png" >}}
{{% /tab %}}
{{% tab name="Vertex AI" %}}
1. For **Incoming model match**, enter `gemini-2.5-flash`.
2. From **Provider**, select **Vertex AI**.
3. Keep **Google credentials** set to **ADC**.
4. For **Vertex project**, enter your Google Cloud project ID. For **Vertex region**, enter `us-central1` or your region.
5. Click **Save model**.

{{< reuse-image-light src="img/ui-llm-add-model-vertex.png" >}}
{{< reuse-image-dark srcDark="img/ui-llm-add-model-vertex.png" >}}
{{% /tab %}}
{{% tab name="Amazon Bedrock" %}}
1. For **Incoming model match**, enter `amazon.nova-lite-v1:0`.
2. From **Provider**, select **Amazon Bedrock**.
3. Keep **AWS credentials** set to **Ambient**.
4. For **AWS region**, enter `us-west-2` or your region.
5. Click **Save model**.

{{< reuse-image-light src="img/ui-llm-add-model-bedrock.png" >}}
{{< reuse-image-dark srcDark="img/ui-llm-add-model-bedrock.png" >}}
{{% /tab %}}
{{% tab name="Azure" %}}
1. For **Incoming model match**, enter `gpt-4.1`.
2. From **Provider**, select **Azure**.
3. For **Azure credentials**, select **API key**. Then select **Env var** and enter `AZURE_API_KEY`.
4. For **Azure resource name**, enter your Azure OpenAI resource name.
5. Click **Save model**.

{{< reuse-image-light src="img/ui-llm-add-model-azure.png" >}}
{{< reuse-image-dark srcDark="img/ui-llm-add-model-azure.png" >}}
{{% /tab %}}
{{% tab name="GitHub Copilot" %}}
1. For **Incoming model match**, enter `gpt-4.1`.
2. From **Provider**, select **GitHub Copilot**.
3. For **Provider API key**, select **Env var** and enter `GH_COPILOT_TOKEN`.
4. Click **Save model**.

{{< reuse-image-light src="img/ui-llm-add-model-copilot.png" >}}
{{< reuse-image-dark srcDark="img/ui-llm-add-model-copilot.png" >}}
{{% /tab %}}
{{% tab name="Custom" %}}
1. For **Incoming model match**, enter `my-model`.
2. From **Provider**, select **Custom**.
3. For **Provider API key**, select **Env var** and enter `CUSTOM_PROVIDER_API_KEY`.
4. For **Base URL**, enter your provider's base URL, such as `https://llm.example.com/v1`. Keep **Chat completions** selected.
5. Click **Save model**.

{{< reuse-image-light src="img/ui-llm-add-model-custom.png" >}}
{{< reuse-image-dark srcDark="img/ui-llm-add-model-custom.png" >}}
{{% /tab %}}
{{% tab name="Baseten" %}}
1. For **Incoming model match**, enter `openai/gpt-oss-120b`.
2. From **Provider**, select **Baseten**.
3. For **Provider API key**, select **Env var** and enter `BASETEN_API_KEY`.
4. Click **Save model**.

{{< reuse-image-light src="img/ui-llm-add-model-baseten.png" >}}
{{< reuse-image-dark srcDark="img/ui-llm-add-model-baseten.png" >}}
{{% /tab %}}
{{% tab name="Cerebras" %}}
1. For **Incoming model match**, enter `gpt-oss-120b`.
2. From **Provider**, select **Cerebras**.
3. For **Provider API key**, select **Env var** and enter `CEREBRAS_API_KEY`.
4. Click **Save model**.

{{< reuse-image-light src="img/ui-llm-add-model-cerebras.png" >}}
{{< reuse-image-dark srcDark="img/ui-llm-add-model-cerebras.png" >}}
{{% /tab %}}
{{% tab name="Cohere" %}}
1. For **Incoming model match**, enter `command-a-03-2025`.
2. From **Provider**, select **Cohere**.
3. For **Provider API key**, select **Env var** and enter `COHERE_API_KEY`.
4. Click **Save model**.

{{< reuse-image-light src="img/ui-llm-add-model-cohere.png" >}}
{{< reuse-image-dark srcDark="img/ui-llm-add-model-cohere.png" >}}
{{% /tab %}}
{{% tab name="DeepInfra" %}}
1. For **Incoming model match**, enter `Qwen/Qwen3-32B`.
2. From **Provider**, select **DeepInfra**.
3. For **Provider API key**, select **Env var** and enter `DEEPINFRA_API_KEY`.
4. Click **Save model**.

{{< reuse-image-light src="img/ui-llm-add-model-deepinfra.png" >}}
{{< reuse-image-dark srcDark="img/ui-llm-add-model-deepinfra.png" >}}
{{% /tab %}}
{{% tab name="DeepSeek" %}}
1. For **Incoming model match**, enter `deepseek-v4-flash`.
2. From **Provider**, select **DeepSeek**.
3. For **Provider API key**, select **Env var** and enter `DEEPSEEK_API_KEY`.
4. Click **Save model**.

{{< reuse-image-light src="img/ui-llm-add-model-deepseek.png" >}}
{{< reuse-image-dark srcDark="img/ui-llm-add-model-deepseek.png" >}}
{{% /tab %}}
{{% tab name="Fireworks AI" %}}
1. For **Incoming model match**, enter `accounts/fireworks/models/gpt-oss-120b`.
2. From **Provider**, select **Fireworks AI**.
3. For **Provider API key**, select **Env var** and enter `FIREWORKS_API_KEY`.
4. Click **Save model**.

{{< reuse-image-light src="img/ui-llm-add-model-fireworks.png" >}}
{{< reuse-image-dark srcDark="img/ui-llm-add-model-fireworks.png" >}}
{{% /tab %}}
{{% tab name="Groq" %}}
1. For **Incoming model match**, enter `llama-3.1-8b-instant`.
2. From **Provider**, select **Groq**.
3. For **Provider API key**, select **Env var** and enter `GROQ_API_KEY`.
4. Click **Save model**.

{{< reuse-image-light src="img/ui-llm-add-model-groq.png" >}}
{{< reuse-image-dark srcDark="img/ui-llm-add-model-groq.png" >}}
{{% /tab %}}
{{% tab name="Hugging Face" %}}
1. For **Incoming model match**, enter `Qwen/Qwen3-32B`.
2. From **Provider**, select **Hugging Face**.
3. For **Provider API key**, select **Env var** and enter `HUGGINGFACE_API_KEY`.
4. Click **Save model**.

{{< reuse-image-light src="img/ui-llm-add-model-huggingface.png" >}}
{{< reuse-image-dark srcDark="img/ui-llm-add-model-huggingface.png" >}}
{{% /tab %}}
{{% tab name="Mistral AI" %}}
1. For **Incoming model match**, enter `mistral-small-latest`.
2. From **Provider**, select **Mistral AI**.
3. For **Provider API key**, select **Env var** and enter `MISTRAL_API_KEY`.
4. Click **Save model**.

{{< reuse-image-light src="img/ui-llm-add-model-mistral.png" >}}
{{< reuse-image-dark srcDark="img/ui-llm-add-model-mistral.png" >}}
{{% /tab %}}
{{% tab name="Ollama" %}}
1. For **Incoming model match**, enter `llama3.2`.
2. From **Provider**, select **Ollama**.
3. Keep **Provider API key** set to **Unset**.
4. For **Base URL**, use `http://localhost:11434/v1` or the URL of your Ollama server.
5. Click **Save model**.

{{< reuse-image-light src="img/ui-llm-add-model-ollama.png" >}}
{{< reuse-image-dark srcDark="img/ui-llm-add-model-ollama.png" >}}
{{% /tab %}}
{{% tab name="OpenRouter" %}}
1. For **Incoming model match**, enter `anthropic/claude-haiku-4.5`.
2. From **Provider**, select **OpenRouter**.
3. For **Provider API key**, select **Env var** and enter `OPENROUTER_API_KEY`.
4. Click **Save model**.

{{< reuse-image-light src="img/ui-llm-add-model-openrouter.png" >}}
{{< reuse-image-dark srcDark="img/ui-llm-add-model-openrouter.png" >}}
{{% /tab %}}
{{% tab name="Together AI" %}}
1. For **Incoming model match**, enter `meta-llama/Llama-3.3-70B-Instruct-Turbo`.
2. From **Provider**, select **Together AI**.
3. For **Provider API key**, select **Env var** and enter `TOGETHER_API_KEY`.
4. Click **Save model**.

{{< reuse-image-light src="img/ui-llm-add-model-togetherai.png" >}}
{{< reuse-image-dark srcDark="img/ui-llm-add-model-togetherai.png" >}}
{{% /tab %}}
{{% tab name="xAI" %}}
1. For **Incoming model match**, enter `grok-4.3`.
2. From **Provider**, select **xAI**.
3. For **Provider API key**, select **Env var** and enter `XAI_API_KEY`.
4. Click **Save model**.

{{< reuse-image-light src="img/ui-llm-add-model-xai.png" >}}
{{< reuse-image-dark srcDark="img/ui-llm-add-model-xai.png" >}}
{{% /tab %}}
{{< /tabs >}}

### Step 5: Send a chat completion request

From another terminal, send a request to the chat completions endpoint.

{{< tabs >}}
{{% tab name="OpenAI" %}}
```sh
curl http://localhost:4000/v1/chat/completions \\
  -H 'content-type: application/json' \\
  -d '{
    "model": "gpt-3.5-turbo",
    "messages": [
      {
        "role": "user",
        "content": "Reply with exactly: OpenAI through agentgateway works"
      }
    ]
  }'
```
{{% /tab %}}
{{% tab name="Anthropic" %}}
```sh
curl http://localhost:4000/v1/chat/completions \\
  -H 'content-type: application/json' \\
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
{{% tab name="Gemini" %}}
```sh
curl http://localhost:4000/v1/chat/completions \\
  -H 'content-type: application/json' \\
  -d '{
    "model": "gemini-2.5-flash",
    "messages": [
      {
        "role": "user",
        "content": "Reply with exactly: Gemini through agentgateway works"
      }
    ]
  }'
```
{{% /tab %}}
{{% tab name="Vertex AI" %}}
```sh
curl http://localhost:4000/v1/chat/completions \\
  -H 'content-type: application/json' \\
  -d '{
    "model": "gemini-2.5-flash",
    "messages": [
      {
        "role": "user",
        "content": "Reply with exactly: Vertex AI through agentgateway works"
      }
    ]
  }'
```
{{% /tab %}}
{{% tab name="Amazon Bedrock" %}}
```sh
curl http://localhost:4000/v1/chat/completions \\
  -H 'content-type: application/json' \\
  -d '{
    "model": "amazon.nova-lite-v1:0",
    "messages": [
      {
        "role": "user",
        "content": "Reply with exactly: Amazon Bedrock through agentgateway works"
      }
    ]
  }'
```
{{% /tab %}}
{{% tab name="Azure" %}}
```sh
curl http://localhost:4000/v1/chat/completions \\
  -H 'content-type: application/json' \\
  -d '{
    "model": "gpt-4.1",
    "messages": [
      {
        "role": "user",
        "content": "Reply with exactly: Azure through agentgateway works"
      }
    ]
  }'
```
{{% /tab %}}
{{% tab name="GitHub Copilot" %}}
```sh
curl http://localhost:4000/v1/chat/completions \\
  -H 'content-type: application/json' \\
  -d '{
    "model": "gpt-4.1",
    "messages": [
      {
        "role": "user",
        "content": "Reply with exactly: GitHub Copilot through agentgateway works"
      }
    ]
  }'
```
{{% /tab %}}
{{% tab name="Custom" %}}
```sh
curl http://localhost:4000/v1/chat/completions \\
  -H 'content-type: application/json' \\
  -d '{
    "model": "my-model",
    "messages": [
      {
        "role": "user",
        "content": "Reply with exactly: Custom through agentgateway works"
      }
    ]
  }'
```
{{% /tab %}}
{{% tab name="Baseten" %}}
```sh
curl http://localhost:4000/v1/chat/completions \\
  -H 'content-type: application/json' \\
  -d '{
    "model": "openai/gpt-oss-120b",
    "messages": [
      {
        "role": "user",
        "content": "Reply with exactly: Baseten through agentgateway works"
      }
    ]
  }'
```
{{% /tab %}}
{{% tab name="Cerebras" %}}
```sh
curl http://localhost:4000/v1/chat/completions \\
  -H 'content-type: application/json' \\
  -d '{
    "model": "gpt-oss-120b",
    "messages": [
      {
        "role": "user",
        "content": "Reply with exactly: Cerebras through agentgateway works"
      }
    ]
  }'
```
{{% /tab %}}
{{% tab name="Cohere" %}}
```sh
curl http://localhost:4000/v1/chat/completions \\
  -H 'content-type: application/json' \\
  -d '{
    "model": "command-a-03-2025",
    "messages": [
      {
        "role": "user",
        "content": "Reply with exactly: Cohere through agentgateway works"
      }
    ]
  }'
```
{{% /tab %}}
{{% tab name="DeepInfra" %}}
```sh
curl http://localhost:4000/v1/chat/completions \\
  -H 'content-type: application/json' \\
  -d '{
    "model": "Qwen/Qwen3-32B",
    "messages": [
      {
        "role": "user",
        "content": "Reply with exactly: DeepInfra through agentgateway works"
      }
    ]
  }'
```
{{% /tab %}}
{{% tab name="DeepSeek" %}}
```sh
curl http://localhost:4000/v1/chat/completions \\
  -H 'content-type: application/json' \\
  -d '{
    "model": "deepseek-v4-flash",
    "messages": [
      {
        "role": "user",
        "content": "Reply with exactly: DeepSeek through agentgateway works"
      }
    ]
  }'
```
{{% /tab %}}
{{% tab name="Fireworks AI" %}}
```sh
curl http://localhost:4000/v1/chat/completions \\
  -H 'content-type: application/json' \\
  -d '{
    "model": "accounts/fireworks/models/gpt-oss-120b",
    "messages": [
      {
        "role": "user",
        "content": "Reply with exactly: Fireworks AI through agentgateway works"
      }
    ]
  }'
```
{{% /tab %}}
{{% tab name="Groq" %}}
```sh
curl http://localhost:4000/v1/chat/completions \\
  -H 'content-type: application/json' \\
  -d '{
    "model": "llama-3.1-8b-instant",
    "messages": [
      {
        "role": "user",
        "content": "Reply with exactly: Groq through agentgateway works"
      }
    ]
  }'
```
{{% /tab %}}
{{% tab name="Hugging Face" %}}
```sh
curl http://localhost:4000/v1/chat/completions \\
  -H 'content-type: application/json' \\
  -d '{
    "model": "Qwen/Qwen3-32B",
    "messages": [
      {
        "role": "user",
        "content": "Reply with exactly: Hugging Face through agentgateway works"
      }
    ]
  }'
```
{{% /tab %}}
{{% tab name="Mistral AI" %}}
```sh
curl http://localhost:4000/v1/chat/completions \\
  -H 'content-type: application/json' \\
  -d '{
    "model": "mistral-small-latest",
    "messages": [
      {
        "role": "user",
        "content": "Reply with exactly: Mistral AI through agentgateway works"
      }
    ]
  }'
```
{{% /tab %}}
{{% tab name="Ollama" %}}
```sh
curl http://localhost:4000/v1/chat/completions \\
  -H 'content-type: application/json' \\
  -d '{
    "model": "llama3.2",
    "messages": [
      {
        "role": "user",
        "content": "Reply with exactly: Ollama through agentgateway works"
      }
    ]
  }'
```
{{% /tab %}}
{{% tab name="OpenRouter" %}}
```sh
curl http://localhost:4000/v1/chat/completions \\
  -H 'content-type: application/json' \\
  -d '{
    "model": "anthropic/claude-haiku-4.5",
    "messages": [
      {
        "role": "user",
        "content": "Reply with exactly: OpenRouter through agentgateway works"
      }
    ]
  }'
```
{{% /tab %}}
{{% tab name="Together AI" %}}
```sh
curl http://localhost:4000/v1/chat/completions \\
  -H 'content-type: application/json' \\
  -d '{
    "model": "meta-llama/Llama-3.3-70B-Instruct-Turbo",
    "messages": [
      {
        "role": "user",
        "content": "Reply with exactly: Together AI through agentgateway works"
      }
    ]
  }'
```
{{% /tab %}}
{{% tab name="xAI" %}}
```sh
curl http://localhost:4000/v1/chat/completions \\
  -H 'content-type: application/json' \\
  -d '{
    "model": "grok-4.3",
    "messages": [
      {
        "role": "user",
        "content": "Reply with exactly: xAI through agentgateway works"
      }
    ]
  }'
```
{{% /tab %}}
{{< /tabs >}}

You can send the same request from the built-in playground.

{{< tabs >}}
{{% tab name="OpenAI" %}}
1. Open the [LLM playground](http://localhost:4000/ui/llm/playground/).
2. From **Model**, select `gpt-3.5-turbo`.
3. In **User message**, enter `Reply with exactly: OpenAI through agentgateway works`.
4. Click **Send**.
{{% /tab %}}
{{% tab name="Anthropic" %}}
1. Open the [LLM playground](http://localhost:4000/ui/llm/playground/).
2. From **Model**, select `claude-haiku-4-5`.
3. In **User message**, enter `Reply with exactly: Anthropic through agentgateway works`.
4. Click **Send**.
{{% /tab %}}
{{% tab name="Gemini" %}}
1. Open the [LLM playground](http://localhost:4000/ui/llm/playground/).
2. From **Model**, select `gemini-2.5-flash`.
3. In **User message**, enter `Reply with exactly: Gemini through agentgateway works`.
4. Click **Send**.
{{% /tab %}}
{{% tab name="Vertex AI" %}}
1. Open the [LLM playground](http://localhost:4000/ui/llm/playground/).
2. From **Model**, select `gemini-2.5-flash`.
3. In **User message**, enter `Reply with exactly: Vertex AI through agentgateway works`.
4. Click **Send**.
{{% /tab %}}
{{% tab name="Amazon Bedrock" %}}
1. Open the [LLM playground](http://localhost:4000/ui/llm/playground/).
2. From **Model**, select `amazon.nova-lite-v1:0`.
3. In **User message**, enter `Reply with exactly: Amazon Bedrock through agentgateway works`.
4. Click **Send**.
{{% /tab %}}
{{% tab name="Azure" %}}
1. Open the [LLM playground](http://localhost:4000/ui/llm/playground/).
2. From **Model**, select `gpt-4.1`.
3. In **User message**, enter `Reply with exactly: Azure through agentgateway works`.
4. Click **Send**.
{{% /tab %}}
{{% tab name="GitHub Copilot" %}}
1. Open the [LLM playground](http://localhost:4000/ui/llm/playground/).
2. From **Model**, select `gpt-4.1`.
3. In **User message**, enter `Reply with exactly: GitHub Copilot through agentgateway works`.
4. Click **Send**.
{{% /tab %}}
{{% tab name="Custom" %}}
1. Open the [LLM playground](http://localhost:4000/ui/llm/playground/).
2. From **Model**, select `my-model`.
3. In **User message**, enter `Reply with exactly: Custom through agentgateway works`.
4. Click **Send**.
{{% /tab %}}
{{% tab name="Baseten" %}}
1. Open the [LLM playground](http://localhost:4000/ui/llm/playground/).
2. From **Model**, select `openai/gpt-oss-120b`.
3. In **User message**, enter `Reply with exactly: Baseten through agentgateway works`.
4. Click **Send**.
{{% /tab %}}
{{% tab name="Cerebras" %}}
1. Open the [LLM playground](http://localhost:4000/ui/llm/playground/).
2. From **Model**, select `gpt-oss-120b`.
3. In **User message**, enter `Reply with exactly: Cerebras through agentgateway works`.
4. Click **Send**.
{{% /tab %}}
{{% tab name="Cohere" %}}
1. Open the [LLM playground](http://localhost:4000/ui/llm/playground/).
2. From **Model**, select `command-a-03-2025`.
3. In **User message**, enter `Reply with exactly: Cohere through agentgateway works`.
4. Click **Send**.
{{% /tab %}}
{{% tab name="DeepInfra" %}}
1. Open the [LLM playground](http://localhost:4000/ui/llm/playground/).
2. From **Model**, select `Qwen/Qwen3-32B`.
3. In **User message**, enter `Reply with exactly: DeepInfra through agentgateway works`.
4. Click **Send**.
{{% /tab %}}
{{% tab name="DeepSeek" %}}
1. Open the [LLM playground](http://localhost:4000/ui/llm/playground/).
2. From **Model**, select `deepseek-v4-flash`.
3. In **User message**, enter `Reply with exactly: DeepSeek through agentgateway works`.
4. Click **Send**.
{{% /tab %}}
{{% tab name="Fireworks AI" %}}
1. Open the [LLM playground](http://localhost:4000/ui/llm/playground/).
2. From **Model**, select `accounts/fireworks/models/gpt-oss-120b`.
3. In **User message**, enter `Reply with exactly: Fireworks AI through agentgateway works`.
4. Click **Send**.
{{% /tab %}}
{{% tab name="Groq" %}}
1. Open the [LLM playground](http://localhost:4000/ui/llm/playground/).
2. From **Model**, select `llama-3.1-8b-instant`.
3. In **User message**, enter `Reply with exactly: Groq through agentgateway works`.
4. Click **Send**.
{{% /tab %}}
{{% tab name="Hugging Face" %}}
1. Open the [LLM playground](http://localhost:4000/ui/llm/playground/).
2. From **Model**, select `Qwen/Qwen3-32B`.
3. In **User message**, enter `Reply with exactly: Hugging Face through agentgateway works`.
4. Click **Send**.
{{% /tab %}}
{{% tab name="Mistral AI" %}}
1. Open the [LLM playground](http://localhost:4000/ui/llm/playground/).
2. From **Model**, select `mistral-small-latest`.
3. In **User message**, enter `Reply with exactly: Mistral AI through agentgateway works`.
4. Click **Send**.
{{% /tab %}}
{{% tab name="Ollama" %}}
1. Open the [LLM playground](http://localhost:4000/ui/llm/playground/).
2. From **Model**, select `llama3.2`.
3. In **User message**, enter `Reply with exactly: Ollama through agentgateway works`.
4. Click **Send**.
{{% /tab %}}
{{% tab name="OpenRouter" %}}
1. Open the [LLM playground](http://localhost:4000/ui/llm/playground/).
2. From **Model**, select `anthropic/claude-haiku-4.5`.
3. In **User message**, enter `Reply with exactly: OpenRouter through agentgateway works`.
4. Click **Send**.
{{% /tab %}}
{{% tab name="Together AI" %}}
1. Open the [LLM playground](http://localhost:4000/ui/llm/playground/).
2. From **Model**, select `meta-llama/Llama-3.3-70B-Instruct-Turbo`.
3. In **User message**, enter `Reply with exactly: Together AI through agentgateway works`.
4. Click **Send**.
{{% /tab %}}
{{% tab name="xAI" %}}
1. Open the [LLM playground](http://localhost:4000/ui/llm/playground/).
2. From **Model**, select `grok-4.3`.
3. In **User message**, enter `Reply with exactly: xAI through agentgateway works`.
4. Click **Send**.
{{% /tab %}}
{{< /tabs >}}

Example successful playground requests:

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
