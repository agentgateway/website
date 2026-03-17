Use the OpenAI Python or Node.js SDK to send requests through agentgateway.

## Before you begin

- agentgateway running at `http://localhost:3000` with a configured LLM backend.
- The OpenAI SDK installed in your project.

## Python

Install the SDK:

```sh
pip install openai
```

Send a request:

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

You can also configure the SDK using environment variables:

```sh
export OPENAI_BASE_URL=http://localhost:3000/v1
export OPENAI_API_KEY=anything
```

Then initialize the client without arguments:

```python
from openai import OpenAI

client = OpenAI()  # picks up OPENAI_BASE_URL and OPENAI_API_KEY from env
```

## Node.js

Install the SDK:

```sh
npm install openai
```

Send a request:

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

## Troubleshooting

### Connection errors

**What's happening:**

The SDK cannot connect to agentgateway.

**Why it's happening:**

agentgateway is not running, or the `base_url` / `baseURL` does not include the `/v1` path.

**How to fix it:**

1. Verify agentgateway is running:
   ```sh
   curl http://localhost:3000/v1/models
   ```
2. Confirm the URL ends with `/v1`.
