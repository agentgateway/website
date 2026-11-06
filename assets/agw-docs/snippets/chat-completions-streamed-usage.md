## Usage in streamed replies {#usage-in-streamed-replies}

Streamed Chat Completions replies through agentgateway always end with a usage chunk, and you cannot turn this chunk off. When you call OpenAI directly, you get the usage chunk only if you set `stream_options.include_usage` to `true`. Through agentgateway, `include_usage` is set to `true` on every streamed request, even if the client sets it to `false`, because the token counts come from the usage data.

Make sure that your client code handles the usage chunk. The usage chunk has an empty `choices` array, so code that reads `choices[0]` from every chunk throws an error when it reaches the usage chunk. Before you read `choices[0]`, check that the `choices` array is not empty.

### Example streamed reply {#streamed-reply-example}

The last chunks of a streamed reply look like the following example. The usage chunk comes right before `data: [DONE]`, and every earlier chunk has `usage: null`.

```text
data: {"id":"chatcmpl-123","model":"gpt-4o-mini","choices":[{"index":0,"delta":{"content":"Hello!"},"finish_reason":null}],"usage":null}

data: {"id":"chatcmpl-123","model":"gpt-4o-mini","choices":[{"index":0,"delta":{},"finish_reason":"stop"}],"usage":null}

data: {"id":"chatcmpl-123","model":"gpt-4o-mini","choices":[],"usage":{"prompt_tokens":12,"completion_tokens":3,"total_tokens":15}}

data: [DONE]
```

### Handle the usage chunk in your code {#handle-usage-chunk}

The following examples print the streamed reply. When the loop reaches the usage chunk, the examples print the token counts instead of reading `choices[0]`.

{{< tabs >}}
{{% tab name="Python" %}}

```python
import openai

client = openai.OpenAI(
    api_key="anything",
    base_url="http://localhost:4000/v1"
)

stream = client.chat.completions.create(
    model="gpt-4o-mini",
    messages=[{"role": "user", "content": "write a short poem"}],
    stream=True
)

for chunk in stream:
    if not chunk.choices:
        # The usage chunk has no choices, only token counts.
        print(f"\nTotal tokens: {chunk.usage.total_tokens}")
        continue
    print(chunk.choices[0].delta.content or "", end="")
```

{{% /tab %}}
{{% tab name="JavaScript" %}}

```javascript
import OpenAI from "openai";

const openai = new OpenAI({
  apiKey: "anything",
  baseURL: "http://localhost:4000/v1",
});

const stream = await openai.chat.completions.create({
  model: "gpt-4o-mini",
  messages: [{ role: "user", content: "write a short poem" }],
  stream: true,
});

for await (const chunk of stream) {
  if (chunk.choices.length === 0) {
    // The usage chunk has no choices, only token counts.
    console.log(`\nTotal tokens: ${chunk.usage.total_tokens}`);
    continue;
  }
  process.stdout.write(chunk.choices[0].delta?.content ?? "");
}
```

{{% /tab %}}
{{< /tabs >}}
