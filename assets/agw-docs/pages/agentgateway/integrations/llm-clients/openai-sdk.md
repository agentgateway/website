Call any LLM provider from your application code through agentgateway with the OpenAI SDK for Python, Node.js, or Go.

Agentgateway exposes an OpenAI-compatible API. Point the SDK's base URL at agentgateway and send OpenAI Chat Completions requests. Agentgateway forwards each request to the provider that matches the `model` field and translates it when the provider uses a different API, such as Anthropic, Bedrock, or Gemini. For per-provider API support, see [About LLMs]({{< link-hextra path="/documentation/llm/about/" >}}).

## Before you begin

{{< reuse "agw-docs/snippets/prereq-agentgateway.md" >}}

{{< reuse "agw-docs/snippets/llm-client-setup-callout.md" >}}

## Example agentgateway configuration

{{% version exclude-if="1.0.x,1.1.x,1.2.x,1.3.x,1.4.x,1.5.x,1.6.x,2.2.x" %}}
You can configure agentgateway in the UI or in your configuration file.

{{< tabs >}}
{{% tab name="UI" %}}
{{< reuse "agw-docs/standalone/llm/clients/ui-openai-port-3000.md" >}}
{{% /tab %}}
{{% tab name="Config file" %}}
{{< reuse "agw-docs/pages/agentgateway/integrations/llm-clients/openai-sdk-config.md" >}}
{{% /tab %}}
{{< /tabs >}}
{{% /version %}}
{{% version include-if="1.0.x,1.1.x,1.2.x,1.3.x,1.4.x,1.5.x,1.6.x,2.2.x" %}}
{{< reuse "agw-docs/pages/agentgateway/integrations/llm-clients/openai-sdk-config.md" >}}
{{% /version %}}

## Python

1. Install the OpenAI SDK in your Python project.

   ```sh
   pip install openai
   ```

2. Create and run the following script to send a request through agentgateway.

   ```python
   from openai import OpenAI

   client = OpenAI(
       base_url="http://localhost:3000/v1",
       api_key="anything",  # placeholder if gateway has no auth
   )

   response = client.chat.completions.create(
       model="gpt-4o-mini",
       messages=[{"role": "user", "content": "Hello!"}],
   )
   print(response.choices[0].message.content)
   ```

You can also configure the SDK using environment variables.

```sh
export OPENAI_BASE_URL=http://localhost:3000/v1
export OPENAI_API_KEY=anything
```

Then initialize the client without arguments.

```python
from openai import OpenAI

client = OpenAI()  # picks up OPENAI_BASE_URL and OPENAI_API_KEY from env
```

## Node.js

1. Install the OpenAI SDK in your Node.js project.

   ```sh
   npm install openai
   ```

2. Create and run the following script to send a request through agentgateway.

   ```javascript
   import OpenAI from "openai";

   const client = new OpenAI({
     baseURL: "http://localhost:3000/v1",
     apiKey: "anything",
   });

   const response = await client.chat.completions.create({
     model: "gpt-4o-mini",
     messages: [{ role: "user", content: "Hello!" }],
   });
   console.log(response.choices[0].message.content);
   ```

## Go

1. Add the OpenAI Go SDK to your module.

   ```sh
   go get github.com/openai/openai-go/v3
   ```

2. Create and run the following program to send a request through agentgateway.

   ```go
   package main

   import (
   	"context"
   	"fmt"

   	"github.com/openai/openai-go/v3"
   	"github.com/openai/openai-go/v3/option"
   )

   func main() {
   	client := openai.NewClient(
   		option.WithBaseURL("http://localhost:3000/v1"),
   		option.WithAPIKey("anything"),
   	)

   	resp, err := client.Chat.Completions.New(context.Background(), openai.ChatCompletionNewParams{
   		Model:    "gpt-4o-mini",
   		Messages: []openai.ChatCompletionMessageParamUnion{openai.UserMessage("Hello!")},
   	})
   	if err != nil {
   		panic(err)
   	}
   	fmt.Println(resp.Choices[0].Message.Content)
   }
   ```

{{% version exclude-if="1.0.x,1.1.x,1.2.x,1.3.x,1.4.x,1.5.x,2.2.x" %}}
## Call more than one provider

Add a model entry for each provider with a provider prefix. The SDK code stays the same; only the `model` value changes.

```yaml
# yaml-language-server: $schema=https://agentgateway.dev/schema/config
llm:
  port: 3000
  models:
  - name: "openai/*"
    provider: openAI
    params:
      apiKey: "$OPENAI_API_KEY"
    transformation:
      model: llmRequest.model.stripPrefix("openai/")
  - name: "anthropic/*"
    provider: anthropic
    params:
      apiKey: "$ANTHROPIC_API_KEY"
    transformation:
      model: llmRequest.model.stripPrefix("anthropic/")
```

```python
client.chat.completions.create(model="openai/gpt-4o-mini", messages=messages)
client.chat.completions.create(model="anthropic/claude-sonnet-4-5", messages=messages)
```

Agentgateway strips the prefix and sends the request to the matching provider. For other ways to name models, see [Multiple LLM providers]({{< link-hextra path="/integrations/llm/providers/multiple-llms/" >}}).

## Migrate from the LiteLLM SDK

The LiteLLM SDK and agentgateway's provider-prefix pattern use the same `provider/model` names, so you can keep your model strings. Replace the `litellm` call with the OpenAI SDK and move provider API keys from your application to the agentgateway configuration in [Call more than one provider](#call-more-than-one-provider).

Before, with LiteLLM:

```python
from litellm import completion

response = completion(
    model="anthropic/claude-sonnet-4-5",
    messages=[{"role": "user", "content": "Hello!"}],
)
print(response.choices[0].message.content)
```

After, with agentgateway:

```python
from openai import OpenAI

client = OpenAI(base_url="http://localhost:3000/v1", api_key="anything")

response = client.chat.completions.create(
    model="anthropic/claude-sonnet-4-5",
    messages=[{"role": "user", "content": "Hello!"}],
)
print(response.choices[0].message.content)
```

| LiteLLM SDK | OpenAI SDK with agentgateway |
|---|---|
| `completion(...)` | `client.chat.completions.create(...)` |
| `acompletion(...)` | `AsyncOpenAI(...).chat.completions.create(...)` |
| `stream=True` | `stream=True` |
| Provider keys, such as `ANTHROPIC_API_KEY`, in the application environment | `params.apiKey` on each model entry in the agentgateway configuration |

If you also run the LiteLLM proxy, convert its configuration with [Migrate from LiteLLM]({{< link-hextra path="/documentation/configuration/import/" >}}).
{{% /version %}}

## Authenticate with a JWT

If agentgateway validates JWTs with a [`jwtAuth` policy]({{< link-hextra path="/documentation/configuration/security/jwt-authn/" >}}), pass the token from your identity provider as the SDK API key. The SDK sends it in the `Authorization: Bearer` header.

```python
client = OpenAI(base_url="http://localhost:3000/v1", api_key=id_token)
```
