---
title: Connect to an agent
weight: 10
description: Route to A2A servers and securely expose their skills through agentgateway.
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
   {{< github url="https://agentgateway.dev/examples/traffic-a2a/config.yaml" >}}
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

2. Run the Hello World agent. The `--with-requirements` flag installs version 1.x of the A2A SDK, which the sample's `requirements.txt` file pins. Without the flag, `uv` uses the older SDK version from the samples repository's lock file, which the sample doesn't work with.

   ```sh
   uv run --directory a2a-samples/samples/python/agents/helloworld --with-requirements requirements.txt .
   ```

## Verify the A2A connection {#verify}

1. In another terminal, get the agent card through agentgateway.

   ```sh
   curl localhost:3000/.well-known/agent-card.json | jq
   ```

   Example output: In the `supportedInterfaces` list, the `url` field is rewritten to point to agentgateway instead of the agent on port 9999.

   ```json
   {
     "name": "Hello World Agent",
     "description": "Just a hello world agent",
     "supportedInterfaces": [
       {
         "url": "http://localhost:3000/",
         "protocolBinding": "JSONRPC",
         "protocolVersion": "1.0"
       }
     ],
     "version": "0.0.1",
     "capabilities": {
       "streaming": true,
       "extendedAgentCard": true
     },
     "defaultInputModes": [
       "text/plain"
     ],
     "defaultOutputModes": [
       "text/plain"
     ],
     "skills": [
       {
         "id": "echo_bot",
         "name": "Echo Bot",
         "description": "An example agent that acknowledges client request and responds with a \"Hello World\" message.",
         "tags": [
           "a2a",
           "echo-example"
         ],
         "examples": [
           "hi",
           "how are you"
         ],
         "inputModes": [
           "text/plain"
         ],
         "outputModes": [
           "text/plain"
         ]
       }
     ]
   }
   ```

2. Send a message to the agent through agentgateway. The request uses the `SendMessage` method of the A2A JSON-RPC binding. The `A2A-Version` header selects version 1.0 of the A2A protocol, which the agent requires.

   ```sh
   curl -s -X POST http://localhost:3000/ \
     -H 'content-type: application/json' \
     -H 'A2A-Version: 1.0' \
     -d '{
       "jsonrpc": "2.0",
       "id": "1",
       "method": "SendMessage",
       "params": {
         "message": {
           "role": "ROLE_USER",
           "messageId": "msg-1",
           "parts": [{"text": "hi"}]
         }
       }
     }' | jq
   ```

   Example output: The agent completes the task and returns its `Hello, World!` reply in the `artifacts` list.

   ```json
   {
     "result": {
       "task": {
         "id": "a8f83882-6ee1-4983-a6d9-eeb4c3f1cdd5",
         "contextId": "4af1dc3c-c394-42d7-8c0c-a4d31b2554cc",
         "status": {
           "state": "TASK_STATE_COMPLETED",
           "message": {
             "messageId": "334d864d-7767-4cc7-ab38-557ea34c8621",
             "role": "ROLE_AGENT",
             "parts": [
               {
                 "text": "Request is completed!"
               }
             ]
           },
           "timestamp": "2026-10-28T12:46:21.057191Z"
         },
         "artifacts": [
           {
             "artifactId": "78c6809b-02a7-4c47-8a3d-5ce4226246a0",
             "parts": [
               {
                 "text": "Hello, World! I have received your request (hi)",
                 "mediaType": "text/plain"
               }
             ]
           }
         ],
         "history": [
           {
             "messageId": "msg-1",
             "contextId": "4af1dc3c-c394-42d7-8c0c-a4d31b2554cc",
             "taskId": "a8f83882-6ee1-4983-a6d9-eeb4c3f1cdd5",
             "role": "ROLE_USER",
             "parts": [
               {
                 "text": "hi"
               }
             ]
           },
           {
             "messageId": "4ee0efa3-5a5b-4957-8f2e-272d46e88f92",
             "role": "ROLE_AGENT",
             "parts": [
               {
                 "text": "Processing request..."
               }
             ]
           }
         ]
       }
     },
     "id": "1",
     "jsonrpc": "2.0"
   }
   ```

3. In the terminal where agentgateway is running, verify that you see a request log for the message. The `a2a.method` field shows the `SendMessage` method, and the `a2a.task.state` field shows the final state of the task.

   ```json
   {"level":"info","time":"2026-10-28T12:46:21.057969Z","scope":"request","gateway":"default/default","listener":"listener0","route":"default/route0","endpoint":"localhost:9999","src.addr":"127.0.0.1:43998","http.method":"POST","http.host":"localhost","http.path":"/","http.version":"HTTP/1.1","http.status":200,"protocol":"a2a","a2a.method":"SendMessage","a2a.response.outcome":"success","a2a.result.kind":"task","a2a.task.state":"TASK_STATE_COMPLETED","a2a.context.id":"4af1dc3c-c394-42d7-8c0c-a4d31b2554cc","duration":"1ms","backend":{"name":"/default/default/bind/3000/listener0/default/route0/backend0","endpoint":"localhost:9999","type":"static","protocol":"a2a"}}
   ```

## View the A2A route in the UI {#ui}

The agentgateway UI shows the listener and route that serve your A2A traffic. To send requests to the agent itself, use the steps in the previous section.

1. Open the [agentgateway UI on port 15000](http://localhost:15000/ui/).

2. From the navigation menu under **Traffic**, click **Routes**. Verify that you see the route for your A2A listener, with the backend set to the ADK agent on `localhost:9999`.

   {{< reuse-image-light src="img/ui-a2a-route.png" >}}
   {{< reuse-image-dark srcDark="img/ui-a2a-route-dark.png" >}}

3. Click **Gateways** to review the gateway that serves A2A traffic on port 3000.

   {{< reuse-image-light src="img/ui-a2a-listener.png" >}}
   {{< reuse-image-dark srcDark="img/ui-a2a-listener-dark.png" >}}
