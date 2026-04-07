Use the OpenAI Python or Node.js SDK to send requests through agentgateway deployed in Kubernetes.

## Before you begin

{{< reuse "agw-docs/snippets/agw-prereq-llm.md" >}}

## Get the gateway URL

{{< reuse "agw-docs/snippets/agw-get-gateway-url-k8s.md" >}}

## Python

1. Install the OpenAI SDK in your Python project.

   ```sh
   pip install openai
   ```

2. Create and run the following script to send a request through agentgateway. Replace `<route-path>` with the path from your HTTPRoute configuration (for example, `/openai`).

   {{< callout type="info" >}}
   Do not include `/v1` in the `base_url` — the OpenAI SDK appends it automatically.
   {{< /callout >}}

   ```python
   import os
   from openai import OpenAI

   gateway_address = os.environ["INGRESS_GW_ADDRESS"]

   client = OpenAI(
       base_url=f"http://{gateway_address}/<route-path>",
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

2. Create and run the following script to send a request through agentgateway. Replace `<route-path>` with the path from your HTTPRoute configuration (for example, `/openai`).

   {{< callout type="info" >}}
   Do not include `/v1` in the `baseURL` — the OpenAI SDK appends it automatically.
   {{< /callout >}}

   ```javascript
   import OpenAI from "openai";

   const gatewayAddress = process.env.INGRESS_GW_ADDRESS;

   const client = new OpenAI({
     baseURL: `http://${gatewayAddress}/<route-path>`,
     apiKey: "anything",
   });

   const response = await client.chat.completions.create({
     model: "gpt-4o-mini",
     messages: [{ role: "user", content: "Hello from Kubernetes!" }],
   });
   console.log(response.choices[0].message.content);
   ```
