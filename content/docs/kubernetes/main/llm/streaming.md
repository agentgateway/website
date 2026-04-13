---
title: Streaming
weight: 45
description: Stream responses from the LLM to the end user through agentgateway.
test:
  streaming-openai:
  - file: content/docs/kubernetes/main/quickstart/install.md
    path: standard
  - file: content/docs/kubernetes/main/setup/gateway.md
    path: all
  - file: content/docs/kubernetes/main/llm/providers/openai.md
    path: openai-setup
  - file: content/docs/kubernetes/main/llm/streaming.md
    path: streaming-openai
---

Models return a response in two main ways: all at once in a single chunk, or in a stream of chunks.

Click through the following tabs to see the request flows for each.

<!-- Diagrams in Excalidraw https://app.excalidraw.com/s/AKnnsusvczX/AZJRSy6wV4F -->

{{< tabs tabTotal="2" items="Single response,Streaming">}}
{{% tab tabName="Single response" %}}

{{< reuse-image src="/img/aig-streaming-false-light.svg" width="600px" alt="Figure: Response without streaming in a single chunk" caption="Figure: Response without streaming in a single chunk">}}

{{< reuse-image-dark srcDark="/img/aig-streaming-false-dark.svg" width="600px" alt="Figure: Response without streaming in a single chunk" caption="Figure: Response without streaming in a single chunk">}}

1. The client sends a request without streaming.
2. The gateway receives the request and forwards it to the LLM.
3. The LLM processes the request and generates a response, such as `"Hello world"`.
4. The gateway forwards the response in a single chunk to the client.

{{% /tab %}}
{{% tab tabName="Streaming" %}}

{{< reuse-image src="/img/aig-streaming-true-light.svg" width="600px" alt="Figure: Response in a stream of chunks" caption="Figure: Response in a stream of chunks">}}
{{< reuse-image-dark srcDark="/img/aig-streaming-true-dark.svg" width="600px" alt="Figure: Response in a stream of chunks" caption="Figure: Response in a stream of chunks">}}

1. The client sends a request with streaming enabled.
2. The gateway receives the request and forwards it to the LLM.
3. The LLM processes the request and generates the first chunk of a response, such as `"Hello"`.
4. The gateway forwards the first chunk to the client.
5. The LLM continues to generate the next chunk of the response, such as `" world"`.
6. The gateway forwards the second chunk to the client.
7. The streaming process repeats until the entire response is generated and returned to the client.

{{% /tab %}}
{{< /tabs >}}

### Streaming benefits {#benefits}

Streaming is useful for:

- Large responses that take a long time to generate. This way, you avoid a lag that could impact the user experience or even trigger a timeout that interrupts the response generation process.
- Responses that are better received in smaller chunks, such as logging to troubleshoot or diagnose issues later.
- Interactive, chat-style applications where you want to see the response in real time.

With {{< reuse "agw-docs/snippets/agentgateway.md" >}}, you can still apply policies to your streaming responses, such as prompt guards, JWT auth, and rate limiting.

## Provider differences {#provider-differences}

The streaming process differs for each LLM provider.

### Request parameter for OpenAI, Azure, and Anthropic {#request-parameter}

OpenAI, Azure, and Anthropic support streaming responses through Server-Sent Events (SSE). Note that Anthropic allows for more granular events such as `message_start` and `content_block_start`.

In the body of your request to the LLM, include the `stream` parameter, such as in the following example:

```json
'{
      "stream": true,
      "model": "gpt-3.5-turbo",
      "messages": [
        {
          "role": "system",
          "content": "You are a skilled developer who is good at explaining basic programming concepts to beginners."
        },
        {
          "role": "user",
          "content": "In a couple words, tell me what I should call my first GitHub repo."
        }
      ]
    }'
```

For more information, see the LLM provider docs:

- [OpenAI](https://platform.openai.com/docs/guides/streaming-responses?api-mode=chat#enable-streaming)
- [Anthropic](https://platform.claude.com/docs/en/build-with-claude/streaming)


### TrafficPolicy for Gemini, Vertex {#policy}

Google uses an HTTP stream protocol which requires special handling. {{< reuse "agw-docs/snippets/agentgateway.md" >}} automatically handles this for Gemini and Vertex when you configure the route type with a {{< reuse "agw-docs/snippets/trafficpolicy.md" >}}.

In the {{< reuse "agw-docs/snippets/trafficpolicy.md" >}} for the HTTPRoute to the LLM provider, set the `routeType` option to `CHAT_STREAMING`, such as the following example:

```yaml
apiVersion: {{< reuse "agw-docs/snippets/trafficpolicy-apiversion.md" >}}
kind: {{< reuse "agw-docs/snippets/trafficpolicy.md" >}}
metadata:
  name: gemini-opt
  namespace: default
spec:
  targetRefs:
  - group: gateway.networking.k8s.io
    kind: HTTPRoute
    name: gemini
  ai:
    routeType: CHAT_STREAMING
```

For more information, see the LLM provider docs:

- [Gemini](https://ai.google.dev/gemini-api/docs/text-generation#streaming-responses)
- [Vertex](https://docs.cloud.google.com/vertex-ai/docs/reference/rest/v1/projects.locations.endpoints/serverStreamingPredict)

## Streaming example {#example}

The following steps show how to stream a response from OpenAI.

### Before you begin

1. {{< reuse "agw-docs/snippets/prereq-agentgateway.md" >}}
2. [Set up access to the OpenAI LLM provider]({{< link-hextra path="/llm/providers/openai/" >}}).

### Stream a response from OpenAI {#openai}

1. Send a request to the OpenAI provider that includes the streaming parameter `"stream": "true"`. For other providers, see [Provider differences](#provider-differences).

   {{< tabs tabTotal="2" items="Cloud Provider LoadBalancer,Port-forward for local testing" >}}
   {{% tab tabName="Cloud Provider LoadBalancer" %}}
   ```sh {paths="streaming-openai"}
   curl "http://${INGRESS_GW_ADDRESS}/openai" -H content-type:application/json  -d '{
      "stream": true,
      "model": "gpt-3.5-turbo",
      "messages": [
        {
          "role": "system",
          "content": "You are a skilled developer who is good at explaining basic programming concepts to beginners."
        },
        {
          "role": "user",
          "content": "In a couple words, tell me what I should call my first GitHub repo."
        }
      ]
    }'
   ```
   {{% /tab %}}
   {{% tab tabName="Port-forward for local testing" %}}
   ```sh
   curl "localhost:8080/openai" -H content-type:application/json  -d '{
      "stream": true,
      "model": "gpt-3.5-turbo",
      "messages": [
        {
          "role": "system",
          "content": "You are a skilled developer who is good at explaining basic programming concepts to beginners."
        },
        {
          "role": "user",
          "content": "In a couple words, tell me what I should call my first GitHub repo."
        }
      ]
    }'
   ```
   {{% /tab %}}
   {{< /tabs >}}

2. In the output, verify that the request succeeds and that you get back a streamed response from the chat completion API.

   ```json
   data: {"id":"chatcmpl-BKq9o...","object":"chat.completion.chunk","created":1744306752,"model":"gpt-3.5-turbo-0125","choices":[{"index":0,"delta":{"role":"assistant","content":"","refusal":null},"logprobs":null,"finish_reason":null}]}

   data: {"id":"chatcmpl-BKq9o...","object":"chat.completion.chunk","created":1744306752,"model":"gpt-3.5-turbo-0125","choices":[{"index":0,"delta":{"content":"You"},"logprobs":null,"finish_reason":null}]}

   data: {"id":"chatcmpl-BKq9o...","object":"chat.completion.chunk","created":1744306752,"model":"gpt-3.5-turbo-0125","choices":[{"index":0,"delta":{"content":" can"},"logprobs":null,"finish_reason":null}]}

   data: {"id":"chatcmpl-BKq9o...","object":"chat.completion.chunk","created":1744306752,"model":"gpt-3.5-turbo-0125","choices":[{"index":0,"delta":{"content":" call"},"logprobs":null,"finish_reason":null}]}
   ...
   data: {"id":"chatcmpl-BKq9o...","object":"chat.completion.chunk","created":1744306752,"model":"gpt-3.5-turbo-0125","choices":[{"index":0,"delta":{},"logprobs":null,"finish_reason":"stop"}]}

   data: [DONE]
   ```

   If you string together the `{"content":...}` chunks, you get the complete response. The `[DONE]` message indicates that the streaming process is complete.

{{< doc-test paths="streaming-openai" >}}
# Verify streaming response contains SSE chunks and terminates with [DONE]
STREAM_RESPONSE=$(curl -s "http://${INGRESS_GW_ADDRESS}/openai" -H content-type:application/json -d '{
  "stream": true,
  "model": "gpt-3.5-turbo",
  "messages": [
    {
      "role": "user",
      "content": "Say hello in one word"
    }
  ]
}')

# Verify the response contains streaming chunk markers
echo "$STREAM_RESPONSE" | grep -q "chat.completion.chunk" || { echo "FAIL: Response does not contain streaming chunks"; exit 1; }
echo "PASS: Response contains streaming chunks"

# Verify the stream terminates with [DONE]
echo "$STREAM_RESPONSE" | grep -q '\[DONE\]' || { echo "FAIL: Response does not end with [DONE]"; exit 1; }
echo "PASS: Stream terminates with [DONE]"
{{< /doc-test >}}
