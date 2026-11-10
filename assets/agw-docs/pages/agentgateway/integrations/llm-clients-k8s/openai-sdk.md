Call configured LLM providers from your application code through agentgateway in Kubernetes with the OpenAI SDK for Python, Node.js, or Go.

Agentgateway exposes an OpenAI-compatible API. Point the SDK's base URL at the gateway and send OpenAI Chat Completions requests. Agentgateway forwards each request to the configured provider and translates it when the provider uses a different API, such as Anthropic, Bedrock, or Gemini. For per-provider API support, see [About LLMs]({{< link-hextra path="/documentation/llm/about/" >}}).

## Before you begin

{{< reuse "agw-docs/snippets/agw-prereq-llm.md" >}}

## Get the gateway URL

{{< reuse "agw-docs/snippets/agw-get-gateway-url-k8s.md" >}}

If you use port-forwarding, keep it running and set the address in the terminal where you run the SDK examples:

```sh
export INGRESS_GW_ADDRESS=localhost:8080
```

## Set the base URL

End the SDK base URL with `/v1`, such as `http://$INGRESS_GW_ADDRESS/v1`. The SDK appends the API path, such as `/chat/completions`, to the base URL.

If your HTTPRoute matches a path prefix, such as `/openai`, put the prefix before `/v1`: `http://$INGRESS_GW_ADDRESS/openai/v1`.

## Python

1. Install the OpenAI SDK in your Python project.

   ```sh
   pip install openai
   ```

2. Create and run the following script to send a request through agentgateway.

   ```python
   import os
   from openai import OpenAI

   gateway_address = os.environ["INGRESS_GW_ADDRESS"]

   client = OpenAI(
       base_url=f"http://{gateway_address}/v1",
       api_key="anything",  # placeholder if gateway has no auth
   )

   response = client.chat.completions.create(
       model="gpt-4o-mini",
       messages=[{"role": "user", "content": "Hello from Kubernetes!"}],
   )
   print(response.choices[0].message.content)
   ```

## Node.js

1. Install the OpenAI SDK in your Node.js project.

   ```sh
   npm install openai
   ```

2. Create and run the following script to send a request through agentgateway.

   ```javascript
   import OpenAI from "openai";

   const gatewayAddress = process.env.INGRESS_GW_ADDRESS;

   const client = new OpenAI({
     baseURL: `http://${gatewayAddress}/v1`,
     apiKey: "anything",
   });

   const response = await client.chat.completions.create({
     model: "gpt-4o-mini",
     messages: [{ role: "user", content: "Hello from Kubernetes!" }],
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
   	"os"

   	"github.com/openai/openai-go/v3"
   	"github.com/openai/openai-go/v3/option"
   )

   func main() {
   	client := openai.NewClient(
   		option.WithBaseURL("http://"+os.Getenv("INGRESS_GW_ADDRESS")+"/v1"),
   		option.WithAPIKey("anything"),
   	)

   	resp, err := client.Chat.Completions.New(context.Background(), openai.ChatCompletionNewParams{
   		Model:    "gpt-4o-mini",
   		Messages: []openai.ChatCompletionMessageParamUnion{openai.UserMessage("Hello from Kubernetes!")},
   	})
   	if err != nil {
   		panic(err)
   	}
   	fmt.Println(resp.Choices[0].Message.Content)
   }
   ```

{{% version exclude-if="1.0.x,1.1.x,1.2.x,1.3.x,1.4.x,1.5.x,2.2.x" %}}
## Call more than one provider

Create an {{< reuse "agw-docs/snippets/agentgatewaymodel.md" >}} for each provider with a provider prefix. The SDK code stays the same; only the `model` value changes.

1. Allow the {{< reuse "agw-docs/snippets/agentgatewaymodel.md" >}} kind on the Gateway listener. Keep `HTTPRoute` in the list to keep HTTPRoutes on other paths, such as `/openai`.

   > [!WARNING]
   > After you allow {{< reuse "agw-docs/snippets/agentgatewaymodel.md" >}}, the listener serves LLM paths such as `/v1/chat/completions` from its models instead of from HTTPRoutes. A request for a model name with no matching model, such as `gpt-4o-mini` without a prefix, returns a model-not-found error.

   ```yaml
   kubectl apply -f- <<EOF
   apiVersion: gateway.networking.k8s.io/v1
   kind: Gateway
   metadata:
     name: agentgateway-proxy
     namespace: {{< reuse "agw-docs/snippets/namespace.md" >}}
   spec:
     gatewayClassName: {{< reuse "agw-docs/snippets/agw-gatewayclass.md" >}}
     listeners:
     - name: http
       port: 80
       protocol: HTTP
       allowedRoutes:
         namespaces:
           from: All
         kinds:
         - group: gateway.networking.k8s.io
           kind: HTTPRoute
         - group: agentgateway.dev
           kind: {{< reuse "agw-docs/snippets/agentgatewaymodel.md" >}}
   EOF
   ```

2. Set `ANTHROPIC_API_KEY` to your Anthropic API key and create a secret for it. The OpenAI secret, `openai-secret`, is from the prerequisites.

   ```sh
   export ANTHROPIC_API_KEY='<your-anthropic-api-key>'
   kubectl create secret generic anthropic-secret -n {{< reuse "agw-docs/snippets/namespace.md" >}} \
     --from-literal="Authorization=$ANTHROPIC_API_KEY"
   ```

3. Create a model for each provider prefix.

   ```yaml
   kubectl apply -f- <<EOF
   apiVersion: agentgateway.dev/v1alpha1
   kind: {{< reuse "agw-docs/snippets/agentgatewaymodel.md" >}}
   metadata:
     name: openai
     namespace: {{< reuse "agw-docs/snippets/namespace.md" >}}
   spec:
     parentRefs:
     - group: gateway.networking.k8s.io
       kind: Gateway
       name: agentgateway-proxy
       sectionName: http
     match:
       model: "openai/*"
     provider: OpenAI
     policies:
       auth:
         secretRef:
           name: openai-secret
       transformations:
       - field: model
         expression: 'llmRequest.model.stripPrefix("openai/")'
   ---
   apiVersion: agentgateway.dev/v1alpha1
   kind: {{< reuse "agw-docs/snippets/agentgatewaymodel.md" >}}
   metadata:
     name: anthropic
     namespace: {{< reuse "agw-docs/snippets/namespace.md" >}}
   spec:
     parentRefs:
     - group: gateway.networking.k8s.io
       kind: Gateway
       name: agentgateway-proxy
       sectionName: http
     match:
       model: "anthropic/*"
     provider: Anthropic
     policies:
       auth:
         secretRef:
           name: anthropic-secret
       transformations:
       - field: model
         expression: 'llmRequest.model.stripPrefix("anthropic/")'
   EOF
   ```

4. Send requests with the prefixed model names.

   ```python
   messages = [{"role": "user", "content": "Hello!"}]
   client.chat.completions.create(model="openai/gpt-4o-mini", messages=messages)
   client.chat.completions.create(model="anthropic/claude-sonnet-4-5", messages=messages)
   ```

Agentgateway strips the prefix and sends the request to the matching provider. For more about models, see [Serve a model]({{< link-hextra path="/documentation/llm/models/serve/" >}}).

## Migrate from the LiteLLM SDK

The example configuration in the previous section accepts `openai/gpt-4o-mini` and `anthropic/claude-sonnet-4-5`, so you can keep those LiteLLM model strings. Other model strings need matching gateway configuration. This example migrates Chat Completions calls. Review provider-specific parameters and other LiteLLM features separately. Replace the `litellm` call with the OpenAI SDK and move provider API keys from your application to Kubernetes secrets, as in [Call more than one provider](#call-more-than-one-provider).

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
import os
from openai import OpenAI

client = OpenAI(base_url=f"http://{os.environ['INGRESS_GW_ADDRESS']}/v1", api_key="anything")

response = client.chat.completions.create(
    model="anthropic/claude-sonnet-4-5",
    messages=[{"role": "user", "content": "Hello!"}],
)
print(response.choices[0].message.content)
```

For asynchronous calls, replace `acompletion` with `AsyncOpenAI`:

```python
import asyncio
import os
from openai import AsyncOpenAI

async_client = AsyncOpenAI(base_url=f"http://{os.environ['INGRESS_GW_ADDRESS']}/v1", api_key="anything")

async def main():
    response = await async_client.chat.completions.create(
        model="anthropic/claude-sonnet-4-5",
        messages=[{"role": "user", "content": "Hello!"}],
    )
    print(response.choices[0].message.content)

asyncio.run(main())
```

| LiteLLM SDK | OpenAI SDK with agentgateway |
|---|---|
| `completion(...)` | `client.chat.completions.create(...)` |
| `await acompletion(...)` | `await async_client.chat.completions.create(...)` |
| `stream=True` | `stream=True` |
| `embedding(...)` | `client.embeddings.create(...)` |
| `num_retries=3` | `OpenAI(..., max_retries=3)` on the client, or a [retry policy]({{< link-hextra path="/documentation/resiliency/retry/retry/" >}}) on the gateway |
| `Router(..., fallbacks=[...])` | A [virtual model with failover routing]({{< link-hextra path="/documentation/llm/models/virtual/#fail-over-when-a-model-degrades" >}}). The client sends the virtual model name. |
| `completion_cost(...)` | Agentgateway prices each request from its [model cost catalog]({{< link-hextra path="/documentation/llm/cost-controls/costs/" >}}) and records the USD cost in access logs, traces, and metrics. |
| Provider keys, such as `ANTHROPIC_API_KEY`, in the application environment | A Kubernetes secret referenced by each {{< reuse "agw-docs/snippets/agentgatewaymodel.md" >}} |

With LiteLLM fallbacks, the failed request moves to the next model. With agentgateway failover, the request that triggers eviction returns an error, and later requests go to the next priority group. To retry the failed request, set `max_retries` on the client or a retry policy on the gateway.
{{% /version %}}

## Authenticate with a JWT

Configure an {{< reuse "agw-docs/snippets/policy.md" >}} with [`jwtAuthentication`]({{< link-hextra path="/documentation/security/jwt/" >}}) on the gateway. Use `mode: Strict` to require a valid token on every request.

Obtain a JWT access token for your gateway API from your identity provider. The token must satisfy the policy's validation rules, including any configured issuer and audience requirements. Set `AGENTGATEWAY_JWT` in your application's environment to the raw token, without the `Bearer ` prefix.

Pass that token as the SDK API key. The SDK sends `Authorization: Bearer <token>`.

```python
import os
from openai import OpenAI

jwt_token = os.environ["AGENTGATEWAY_JWT"]
client = OpenAI(
    base_url=f"http://{os.environ['INGRESS_GW_ADDRESS']}/v1",
    api_key=jwt_token,
)
```

This token authenticates the caller to agentgateway. Keep the upstream provider API keys in the Kubernetes secrets referenced by your backend or model resources. Obtain a fresh token when it expires and update the SDK client before making more requests.
