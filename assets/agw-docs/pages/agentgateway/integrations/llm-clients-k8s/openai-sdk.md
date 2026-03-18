Use the OpenAI Python or Node.js SDK to send requests through agentgateway deployed in Kubernetes.

## Before you begin

- [Get the gateway URL]({{< link-hextra path="/integrations/llm-clients/" >}}).
- Identify the route path from your HTTPRoute, such as `/openai`.

## Python

1. Install the OpenAI SDK in your Python project.

   ```sh
   pip install openai
   ```

2. Send a request, replacing `<route-path>` with the path from your HTTPRoute configuration (for example, `/openai`).

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

2. Send a request, replacing `<route-path>` with the path from your HTTPRoute configuration (for example, `/openai`).

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

## Troubleshooting

### Connection errors

**What's happening:**

The SDK cannot connect to agentgateway.

**Why it's happening:**

The `base_url` or `baseURL` is incorrect, or the gateway is not reachable.

**How to fix it:**

1. Verify the gateway is reachable:
   ```sh
   curl http://$INGRESS_GW_ADDRESS/<route-path> -v
   ```
2. Confirm the URL does not include `/v1` — the SDK appends that automatically.
