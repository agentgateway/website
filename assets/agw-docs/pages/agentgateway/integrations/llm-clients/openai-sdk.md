Use the OpenAI Python or Node.js SDK to send requests through agentgateway.

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
