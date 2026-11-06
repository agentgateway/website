## Usage in streamed replies {#usage-in-streamed-replies}

Unlike calling OpenAI directly, streamed Chat Completions replies through agentgateway always include usage data, which is where the token counts come from. On a request with `"stream": true`, `stream_options.include_usage` is set to `true`, even if the client sets the field to `false`.

As a result, every streamed reply ends with one extra chunk before `data: [DONE]`. That chunk has an empty `choices` array and a `usage` object with the token counts for the whole request. All earlier chunks have `usage: null`.

```text
data: {"id":"chatcmpl-123","model":"gpt-4o-mini","choices":[{"index":0,"delta":{"content":"Hello!"},"finish_reason":null}],"usage":null}

data: {"id":"chatcmpl-123","model":"gpt-4o-mini","choices":[{"index":0,"delta":{},"finish_reason":"stop"}],"usage":null}

data: {"id":"chatcmpl-123","model":"gpt-4o-mini","choices":[],"usage":{"prompt_tokens":12,"completion_tokens":3,"total_tokens":15}}

data: [DONE]
```

Reading `choices[0]` from the usage chunk fails, so check that the `choices` array is not empty before you read it.
