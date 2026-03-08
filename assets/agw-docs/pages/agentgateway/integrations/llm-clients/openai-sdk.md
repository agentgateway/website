# OpenAI SDK

Configure the OpenAI SDK (Python and Node.js) to use agentgateway as the LLM backend.

## Overview

The official OpenAI SDKs support custom base URLs, allowing you to route requests through agentgateway while using the same SDK interface. This works with any backend provider configured in agentgateway (OpenAI, Anthropic, Bedrock, Vertex, etc.).

## Python SDK

### Installation

```bash
pip install openai
```

### Basic usage

```python
from openai import OpenAI

client = OpenAI(
    base_url="http://localhost:3000/v1",
    api_key="anything",  # Use placeholder if gateway has no auth
)

response = client.chat.completions.create(
    model="gpt-4o-mini",
    messages=[
        {"role": "user", "content": "Hello, how are you?"}
    ],
)

print(response.choices[0].message.content)
```

### Using environment variables

Set environment variables instead of hard-coding credentials:

```bash
export OPENAI_API_BASE=http://localhost:3000/v1
export OPENAI_API_KEY=anything
```

Then in Python:

```python
from openai import OpenAI

# Automatically uses OPENAI_API_BASE and OPENAI_API_KEY
client = OpenAI()

response = client.chat.completions.create(
    model="gpt-4o-mini",
    messages=[{"role": "user", "content": "Hello!"}],
)

print(response.choices[0].message.content)
```

### Streaming responses

```python
from openai import OpenAI

client = OpenAI(
    base_url="http://localhost:3000/v1",
    api_key="anything",
)

stream = client.chat.completions.create(
    model="gpt-4o-mini",
    messages=[{"role": "user", "content": "Write a short story"}],
    stream=True,
)

for chunk in stream:
    if chunk.choices[0].delta.content:
        print(chunk.choices[0].delta.content, end="")
```

### Advanced parameters

```python
response = client.chat.completions.create(
    model="gpt-4o-mini",
    messages=[
        {"role": "system", "content": "You are a helpful assistant."},
        {"role": "user", "content": "Explain quantum computing"},
    ],
    temperature=0.7,
    max_tokens=500,
    top_p=0.9,
    frequency_penalty=0.0,
    presence_penalty=0.0,
)
```

### Error handling

```python
from openai import OpenAI, OpenAIError

client = OpenAI(
    base_url="http://localhost:3000/v1",
    api_key="anything",
)

try:
    response = client.chat.completions.create(
        model="gpt-4o-mini",
        messages=[{"role": "user", "content": "Hello!"}],
    )
    print(response.choices[0].message.content)
except OpenAIError as e:
    print(f"OpenAI API error: {e}")
except Exception as e:
    print(f"Unexpected error: {e}")
```

## Node.js SDK

### Installation

```bash
npm install openai
# or
yarn add openai
```

### Basic usage

```javascript
import OpenAI from "openai";

const client = new OpenAI({
  baseURL: "http://localhost:3000/v1",
  apiKey: "anything", // Use placeholder if gateway has no auth
});

const response = await client.chat.completions.create({
  model: "gpt-4o-mini",
  messages: [
    { role: "user", content: "Hello, how are you?" },
  ],
});

console.log(response.choices[0].message.content);
```

### Using environment variables

Set environment variables:

```bash
export OPENAI_API_BASE=http://localhost:3000/v1
export OPENAI_API_KEY=anything
```

Then in JavaScript:

```javascript
import OpenAI from "openai";

// Automatically uses OPENAI_API_BASE and OPENAI_API_KEY from env
const client = new OpenAI();

const response = await client.chat.completions.create({
  model: "gpt-4o-mini",
  messages: [{ role: "user", content: "Hello!" }],
});

console.log(response.choices[0].message.content);
```

### Streaming responses

```javascript
import OpenAI from "openai";

const client = new OpenAI({
  baseURL: "http://localhost:3000/v1",
  apiKey: "anything",
});

const stream = await client.chat.completions.create({
  model: "gpt-4o-mini",
  messages: [{ role: "user", content: "Write a short story" }],
  stream: true,
});

for await (const chunk of stream) {
  const content = chunk.choices[0]?.delta?.content || "";
  process.stdout.write(content);
}
```

### Advanced parameters

```javascript
const response = await client.chat.completions.create({
  model: "gpt-4o-mini",
  messages: [
    { role: "system", content: "You are a helpful assistant." },
    { role: "user", content: "Explain quantum computing" },
  ],
  temperature: 0.7,
  max_tokens: 500,
  top_p: 0.9,
  frequency_penalty: 0.0,
  presence_penalty: 0.0,
});
```

### Error handling

```javascript
import OpenAI from "openai";

const client = new OpenAI({
  baseURL: "http://localhost:3000/v1",
  apiKey: "anything",
});

try {
  const response = await client.chat.completions.create({
    model: "gpt-4o-mini",
    messages: [{ role: "user", content: "Hello!" }],
  });
  console.log(response.choices[0].message.content);
} catch (error) {
  if (error instanceof OpenAI.APIError) {
    console.error(`OpenAI API error: ${error.message}`);
    console.error(`Status: ${error.status}`);
  } else {
    console.error(`Unexpected error: ${error}`);
  }
}
```

## Example agentgateway configuration

Here's a gateway configuration for SDK usage with multiple backends:

```yaml
# yaml-language-server: $schema=https://agentgateway.dev/schema/config
binds:
- port: 3000
  listeners:
  - routes:
    - policies:
        backendAuth:
          key: $OPENAI_API_KEY
      backends:
      - ai:
          name: openai
          provider:
            openAI:
              model: gpt-4o-mini

- port: 3001
  listeners:
  - routes:
    - policies:
        backendAuth:
          key: $ANTHROPIC_API_KEY
      backends:
      - ai:
          name: anthropic
          provider:
            anthropic:
              model: claude-sonnet-4-20250514
```

Access different backends by changing the base URL:
- OpenAI backend: `http://localhost:3000/v1`
- Anthropic backend: `http://localhost:3001/v1`

## Function calling

Both SDKs support function calling through agentgateway:

### Python

```python
tools = [
    {
        "type": "function",
        "function": {
            "name": "get_weather",
            "description": "Get current weather for a location",
            "parameters": {
                "type": "object",
                "properties": {
                    "location": {"type": "string", "description": "City name"},
                },
                "required": ["location"],
            },
        },
    }
]

response = client.chat.completions.create(
    model="gpt-4o-mini",
    messages=[{"role": "user", "content": "What's the weather in Boston?"}],
    tools=tools,
)
```

### Node.js

```javascript
const tools = [
  {
    type: "function",
    function: {
      name: "get_weather",
      description: "Get current weather for a location",
      parameters: {
        type: "object",
        properties: {
          location: { type: "string", description: "City name" },
        },
        required: ["location"],
      },
    },
  },
];

const response = await client.chat.completions.create({
  model: "gpt-4o-mini",
  messages: [{ role: "user", content: "What's the weather in Boston?" }],
  tools: tools,
});
```

## Embeddings

Both SDKs support embeddings API:

### Python

```python
response = client.embeddings.create(
    model="text-embedding-3-small",
    input="The quick brown fox jumps over the lazy dog",
)

print(response.data[0].embedding)
```

### Node.js

```javascript
const response = await client.embeddings.create({
  model: "text-embedding-3-small",
  input: "The quick brown fox jumps over the lazy dog",
});

console.log(response.data[0].embedding);
```

## Verification

Test your SDK connection:

```bash
# Python
python -c "from openai import OpenAI; client = OpenAI(base_url='http://localhost:3000/v1', api_key='anything'); print(client.chat.completions.create(model='gpt-4o-mini', messages=[{'role': 'user', 'content': 'Hello'}]).choices[0].message.content)"

# Node.js
node -e "import('openai').then(({default: OpenAI}) => {const c = new OpenAI({baseURL: 'http://localhost:3000/v1', apiKey: 'anything'}); c.chat.completions.create({model: 'gpt-4o-mini', messages: [{role: 'user', content: 'Hello'}]}).then(r => console.log(r.choices[0].message.content))})"
```

## Troubleshooting

### Connection errors

- Verify agentgateway is running: `curl http://localhost:3000/v1/models`.
- Check base URL includes `/v1` path.
- Ensure firewall allows connections.

### Authentication errors

- If gateway has no auth, use placeholder: `"anything"`.
- If using `backendAuth`, ensure gateway has valid provider credentials.
- Check agentgateway logs for auth errors.

### Model not found

- Verify model name matches agentgateway backend configuration.
- Check agentgateway logs for backend connection errors.

### Rate limiting

If you encounter rate limits, they may be enforced by agentgateway policies. Check your gateway configuration for rate limit policies.

## Related documentation

- [OpenAI Python SDK Documentation](https://github.com/openai/openai-python)
- [OpenAI Node.js SDK Documentation](https://github.com/openai/openai-node)
- [agentgateway LLM Configuration]({{< link-hextra path="/llm/" >}})
- [Backend Authentication]({{< link-hextra path="/security/policies/backend-auth/" >}})
