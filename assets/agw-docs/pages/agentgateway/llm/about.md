{{< reuse "agw-docs/snippets/agentgateway-capital.md" >}} provides seamless integration with various Large Language Model (LLM) providers. This way, you can consume AI services through a unified interface while still maintain flexibility in the providers that you use.

## What is an LLM?

Large Language Model (LLMs) are very large, deep learning models that are pre-trained on massive amounts of unlabeled and self-supervised data, often containing billions of words. LLMs extract meanings from a sequence of text and can understand the relationship between words and phrases in it. Based on this understanding, the LLM can then predict and generate natural language, and perform related tasks, such as answering questions, summarizing text, translating between languages, or writing content. LLMs can be fine-tuned on a smaller, more specific data set so that it can perform a more specific task more accurately. 

While LLMs were originally designed to be trained on text and natural language, they are now becoming multimodal, supporting different media types, such as images and videos. 

## Common problems with LLM consumption

When adopting an LLM on an enterprise-level, you typically run into the following issues: 

* **Data leakage and privacy**: When interacting with LLMs, it is essential to comply with federal laws and to not leak any PII (personally identifiable information) or other sensitive information in prompts. For example, users might enter personal credit card or customer related information, such as account numbers and names. Attackers might also trick the model into revealing previous user data that is still stored in the context. To prevent sensitive information from leaking to the LLM provider, prompt guards must be in place that help to filter, block, monitor, and control LLM inputs and outputs to find offensive content, prevent misuse, and ensure ethical and responsible AI usage.

* **Cost controls (budget and spend limits)**: Compared to traditional APIs, LLM queries are long-running, meaning the LLM must parse through its large data set iteratively to compute one token at a time. All tokens must then be summarized to generate a prediction. Given the large amounts of data that the LLM parses, GPUs are required to run LLMs efficiently, which are costly to run and maintain. Limiting the amount of tokens that can be used and monitoring token consumption are critical to keep costs to a minimum. 

* **Fan-out patterns**: LLMs are limited by static training data. This limitation can make seemingly simple questions difficult to answer. For example, answering a simple question, such as `What is the weather today?` requires the LLM to have access to several real-time information, such as the location, time, and weather forecast. Integrating LLMs with other MCP servers and agents to perform these tasks becomes essential to accurately answer questions of this nature. 

* **Security**: To protect your LLM from being consumed by unauthorized users, you typically want to authenticate with the LLM before you start sending requests. Managing credentials, such as API keys, and monitoring the traffic to the LLM becomes essential to protect access to the LLM . 

* **Scalability and reliability**: When relying on an LLM to perform specific tasks in your environment, you must put measures in place that prevent your applications from failing, being overwhelmed, or performing inefficiently. This includes retries and timeouts, request rate limiting, and multi-model failovers. 



## Supported providers

{{< reuse "agw-docs/snippets/llm-comparison.md" >}}

> [!NOTE]
> Don't see your provider? You might still be able to use it with agentgateway! Many LLM providers offer OpenAI-compatible APIs. To get started, follow the [OpenAI compatible]({{< link-hextra path="/integrations/llm/providers/openai-compatible/" >}}) docs.

{{% version exclude-if="1.0.x,1.1.x,1.2.x,1.3.x,1.4.x,1.5.x,2.2.x" %}}
## How requests reach a provider {#request-translation}

Clients can call the gateway in several LLM API formats, such as OpenAI Chat Completions, OpenAI Responses, Anthropic Messages, and native Gemini. The route type tells the gateway which format the client sent. On an {{< reuse "agw-docs/snippets/agentgatewaymodel.md" >}}, the standard serving paths, such as `/v1/messages`, set the route type. On an {{< reuse "agw-docs/snippets/backend.md" >}}, you map paths to route types in `policies.ai.routes`. When the provider supports that format, the request is sent to the provider unchanged in format. When the provider does not support it, the request is converted to a format that the provider supports, and the reply is converted back to the format that the client called. For the route types, see [API types]({{< link-hextra path="/documentation/llm/api-types/" >}}).

### Query strings on converted requests {#query-strings-on-converted-requests}

A client query string belongs to the API format that the client called. For the `Completions`, `Messages`, `Responses`, and `GenerateContent` route types, the client query string is kept when the provider receives the same format and is dropped when the request is converted to another format. For example, a Messages request to `/v1/messages?beta=true` that is converted to Chat Completions for a Gemini provider reaches the provider without `?beta=true`.

These cases differ:

- An Amazon Bedrock request on the Runtime endpoint always drops the client query string, because Runtime serves only the Bedrock APIs.
- A built-in provider on an {{< reuse "agw-docs/snippets/backend.md" >}} that sets `host` without `pathPrefix` receives the client path and query string unchanged.
- A `Passthrough` route forwards the client query string, because no conversion happens.
{{% /version %}}
