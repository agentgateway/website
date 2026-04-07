---
title: Connect to an agent
weight: 10
description:
---

Proxy requests to an agent that communicates via the agent-to-agent protocol (A2A).

{{< reuse "agw-docs/snippets/kgateway-callout.md" >}}

## Before you begin

1. {{< reuse "agw-docs/snippets/prereq-agentgateway.md" >}}
2. {{< reuse "agw-docs/snippets/prereq-uv.md" >}}

## Set up the agentgateway {#agentgateway}

Create an agentgateway that proxies requests to the ADK agent that you create later.

1. Create a listener and target configuration for your agentgateway. In this example, the agentgateway is configured as follows:
   * **Listener**: An HTTP listener is configured for the A2A protocol and exposed on port 3000.
   * **Backend**: The agentgateway targets a backend on your localhost port 9999, which you create in a subsequent step.
   ```yaml
   cat <<EOF > config.yaml
   {{< github url="https://agentgateway.dev/examples/a2a/config.yaml" >}}
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

2. In another terminal tab, manually send a request to the agent card endpoint through agentgateway.

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

## Try out the playground {#playground}

Use the agentgateway playground to send a request to the ADK agent that you set up earlier.

1. Open the [agentgateway UI on port 15000](http://localhost:15000/ui/).

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

      {{< reuse-image src="img/ui-a2a-skills.png" >}}

3. Select the **Returns hello world** skill. In the **Message** field, enter a prompt, such as `Say hello`, and click **Send Task**.

4. Verify that you get back a message from the ADK agent stating that your request was processed successfully.
   {{< reuse-image src="img/ui-a2a-success.png" >}}
