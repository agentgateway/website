Use the OpenAI Python or Node.js SDK to send requests through agentgateway.

## Before you begin

- Agentgateway running at `http://localhost:3000` with a configured LLM backend.
- The OpenAI SDK installed in your project.

## Example agentgateway configuration

```yaml
# yaml-language-server: $schema=https://agentgateway.dev/schema/config
llm:
  port: 3000
  models:
  - name: "*"
    provider: openAI
    params:
      apiKey: "$OPENAI_API_KEY"
```

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
