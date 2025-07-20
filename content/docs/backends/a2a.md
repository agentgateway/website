---
title: A2A
weight: 10
description:
---

Proxy requests to an agent that communicates via the agent-to-agent protocol (A2A).

## About A2A

Agent-to-agent, or [A2A](https://github.com/google/A2A), is an open protocol that enables communication and interoperability between opaque agentic applications. Developed by Google, A2A defines a common language that enables agents to show their capabilities and help them negotiate how they interact with the user, such as via text, forms, or bidirectional audio or video, irrespective of the framework or vendor they are built on.

## Set up the agentgateway {#agentgateway}

Create an agentgateway that proxies requests to the reimbursement agent that you created earlier.

1. Create a listener and target configuration for your agentgateway. In this example, the agentgateway is configured as follows:
   * **Listener**: An HTTP listener is configured for the A2A protocol and exposed on port 3000.
   * **Backend**: The agentgateway targets a backend on your localhost port 9999, which you create in a subsequent step.
   ```yaml
   cat <<EOF > config.yaml
   {{< github url="https://raw.githubusercontent.com/agentgateway/agentgateway/refs/heads/main/examples/a2a/config.yaml" >}}
   EOF
   ```

2. Create the agentgateway.
   ```sh
   agentgateway -f config.yaml
   ```

## Set up an ADK agent {#hello-world-agent}

The following steps use the [A2A sample repository](https://github.com/a2aproject/a2a-samples).

1. Clone the A2A sample repository.
   ```sh
   git clone https://github.com/a2aproject/a2a-samples.git
   ```

2. Run the Hello World agent.

   ```sh
   uv run --directory a2a-samples/samples/python/agents/helloworld .
   ```

## Verify the A2A connection {#verify}

1. In another terminal, run the client and send several test messages to the Hello World agent.

   ```sh
   uv run --directory a2a-samples/samples/python/hosts/cli . --agent http://localhost:3000
   ```

   Example output:

   ```
   ======= Agent Card ========
   {"capabilities":{"streaming":true},"defaultInputModes":["text"],"defaultOutputModes":["text"],"description":"Just a hello world agent","name":"Hello World Agent","protocolVersion":"0.2.5","skills":[{"description":"just returns hello world","examples":["hi","hello world"],"id":"hello_world","name":"Returns hello world","tags":["hello world"]}],"supportsAuthenticatedExtendedCard":true,"url":"http://localhost:3000","version":"1.0.0"}
   =========  starting a new task ========

   What do you want to send to the agent? (:q or quit to exit):
   ```

   Type a sample message, such as `hi`, press enter to skip select file, and then send the message by pressing enter again.

   The agent responded with `Hello World` by taking a look at the end of the respond `{"kind":"text","text":"Hello World"}],"role":"agent"}`

2. In another terminal tab, manually send a request to the [agent card endpoint](https://www.agentcard.net/) through agentgateway.

   ```sh
   curl localhost:3000/.well-known/agent.json | jq
   ```

   Example output: Notice that the `url` field is rewritten to point to the agentgateway.

   ```json
   {
     "capabilities": {
       "streaming": true
     },
     "defaultInputModes": [
       "text"
     ],
     "defaultOutputModes": [
       "text"
     ],
     "description": "Just a hello world agent",
     "name": "Hello World Agent",
     "protocolVersion": "0.2.5",
     "skills": [
       {
         "description": "just returns hello world",
         "examples": [
           "hi",
           "hello world"
         ],
         "id": "hello_world",
         "name": "Returns hello world",
         "tags": [
           "hello world"
         ]
       }
     ],
     "supportsAuthenticatedExtendedCard": true,
     "url": "http://localhost:3000",
     "version": "1.0.0"
   }
   ```

3. In the tab where the agentgateway is running, verify that you see request logs from your client query to the Hello World agent, such as the following example.

   ```text
   2025-07-10T18:10:46.547567Z	info	request	gateway=bind/3000 listener=listener0 route=route0 endpoint=localhost:9999 src.addr=[::1]:59257 http.method=POST http.host=localhost http.path=/ http.version=HTTP/1.1 http.status=200 a2a.method=message/stream duration=3ms
   ```

<!--TODO ui steps
## Try out the ADK agent

Use the agentgateway playground to send a request to the reimbursement agent that you set up earlier.

1. Open the [agentgateway UI](http://localhost:15000/ui/).

2. Connect to the MCP server with the agentgateway UI playground.
   1. In your `config.yaml` file, add the following CORS policy to allow requests from the agentgateway UI playground. The config automatically reloads when you save the file.

      ```yaml
      binds:
      - post: 3000
        listeners:
        - routes:
          - policies:
              cors:
                allowOrigins:
                  - "*"
                allowHeaders:
                  - "*"
      ...
      ```
   1. Go to the agentgateway UI [**Playground**](http://localhost:15000/ui/playground/).
   2. In the **Connection Settings** card, select your listener and the **A2A target**, and click **Connect**. The agentgateway UI connects to the A2A target and retrieves all the skills that the target provides.
   3. Verify that you see a list of **Available Skills**.

      {{< reuse-image src="img/agentgateway-ui-playground-skills.png" >}}

3. Select the **Process Reimbursement Tool** skill. In the **Message** field, enter a prompt, such as `Can you reimburse me for my trip to Kubecon on 4/2/25, amount: $1000?`, and click **Send Task**.

4. Verify that you get back a message from the ADK agent stating that your request was processed successfully.
   {{< reuse-image src="img/agentgateway-ui-adkagent-success.png" >}}

5. Review the logs of your agent and verify that you see the reimbursement form filled out with the information that you entered in your prompt.

   ```
   -----------------------------------------------------------
   Function calls:
   name: return_form, args: {'form_request': '{"amount": "$1000", "date": "4/2/25", "purpose": "Kubecon trip", "request_id": "request_id_2241162"}'}
   -----------------------------------------------------------
   Raw response:
   {"candidates":[{"content":{"parts":[{"function_call":{"args":{"form_request":"{\"amount\": \"$1000\", \"date\": \"4/2/25\", \"purpose\": \"Kubecon trip\", \"request_id\": \"request_id_2241162\"}"},"name":"return_form"}}],"role":"model"},"finish_reason":"STOP","avg_logprobs":-0.017740900699908916}],"model_version":"gemini-2.0-flash-001","usage_metadata":{"candidates_token_count":52,"candidates_tokens_details":[{"modality":"TEXT","token_count":52}],"prompt_token_count":628,"prompt_tokens_details":[{"modality":"TEXT","token_count":628}],"total_token_count":680},"automatic_function_calling_history":[]}
   -----------------------------------------------------------
   ```

-->
