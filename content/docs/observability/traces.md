---
title: Traces
weight: 20
description:
---

The agentproxy integrates with Jaeger as the tracing platform. [Jaeger](https://www.jaegertracing.io) is an open source tool that helps you follow the path of a request as it is forwarded between microservices. The chain of events and interactions are captured by an OpenTelemetry pipeline that is configured to send traces to the Jaeger agent. You can then visualize the traces by using the Jaeger UI. 

## Set up Jaeger

Use `docker compose` to spin up a Jaeger instance with the following components: 
* An OpenTelemetry collector that receives traces from the agentproxy. The collector is exposed on `http://localhost:4317`. 
* A Jaeger agent that receives the collected traces. The agent is exposed on `http://localhost:14268`. 
* A Jaeger UI that is exposed on `http://localhost:16686`. 

```sh
docker compose -f - up -d <<EOF
{{< github url="https://raw.githubusercontent.com/agentproxy-dev/agentproxy/refs/heads/main/examples/telemetry/docker-compose.yaml" >}}
EOF
```

## Configure the agentproxy

1. Create a configuration for your agentproxy. 
   * **Listener**: An SSE listener that listens for incoming traffic on port 3000. 
   * **Traces**: The agentproxy is configured to send traces to the OpenTelemetry collector that you exposed on `http://localhost:4317`. 
   * **Target**: The agentproxy targets a sample, open source MCP test server, `server-everything`. 
   ```sh
   cat <<EOF > ./config.json
   {
     "type": "static",
     "listeners": [
       {
         "sse": {
           "address": "[::]",
           "port": 3000
          }
       }
     ],
     "tracing": {
       "tracer": {
         "otlp": {
           "endpoint": "http://localhost:4317"
         }
       }
     },
     "targets": {
       "mcp": [
         {
           "name": "everything",
           "stdio": {
             "cmd": "npx",
             "args": [
               "@modelcontextprotocol/server-everything"
             ]
           }
         }
       ]
     }
   }
   EOF
   ```

2. Run the agentproxy. 
   ```sh
   agentproxy -f ./config.json
   ```

## Verify traces

1. Run the MCP Inspector. 
   ```sh
   SERVER_PORT=9000 npx @modelcontextprotocol/inspector
   ```

2. Open the MCP inspector at the address from the output of the previous command, such as `http://localhost:5173?proxyPort=9000`.

3. Connect to the agentproxy. 
   1. Select `SSE` from the **Transport Type** drop down. 
   2. Enter `http://localhost:3000/sse` in the **URL** field. 
   3. Click **Connect** to connect to the agentproxy. 
   
4. From the menu bar, select **Tools**. 
   2. Click **List Tools**. 
   3. Select the `everything_echo` tool, enter any string in the **message** field, such as `hello`, and click **Run Tool**. Verify that access to the tool is granted and that you see your message echoed. 
      {{< reuse-image src="img/mcp-access-granted.png" >}}  

5. Open the [Jaeger UI](http://localhost:16686). 

6. View traces. 
   1. From the **Service** drop down, select `agentproxy`. 
   2. Click **Find Traces**. 
   3. Verify that you can see trace spans for listing the MCP tools (`list_tools`) and calling a tool (`call_tool`).
   
   {{< reuse-image src="img/jaeger-traces.png">}}
   
## Add tags to traces

You can optionally enrich the traces that are captured by the agentproxy with tags. Tags are key-value pairs that can have the following format: 
* **Static key-value pair**, where the key and value do not change. For example, use `"custom-tag": "test"` to add this tag to all traces that are captured by the agentproxy. 
* **Claim-based key-value pair**, where you map the value of a specific JWT claim to a key. For example, if the username is captured in a `sub` claim in your JWT, you can map that username to a `user` tag by using the following syntax `"user": "@sub"`. 

1. Download a sample, local JWT public key file. You use this file to validate JWTs later. 
   ```sh
   curl -o pub-key https://raw.githubusercontent.com/agentproxy-dev/agentproxy/refs/heads/main/manifests/jwt/pub-key
   ```

2. Create a configuration file for your agentproxy. In this example, you configure the following elements: 
   * **Listener**: An SSE listener that listens for incoming traffic on port 3000. The listener requires a JWT to be present in an `Authorization` header. You use the local JWT public key file to validate the JWT. Only JWTs that include the `sub: me` claim can authenticate with the agentproxy successfully. If the request has a JWT that does not include this claim, the request is denied.
   * **Traces**: The agentproxy is configured to send traces to the OpenTelemetry collector that you exposed on `http://localhost:4317`. In addition, the agentproxy is configured to inject the `custom-tag: test` tag and to extract the `sub` claim from the JWT token and map it to the `user` tag. 
   * **Target**: The agentproxy targets a sample, open source MCP test server, `server-everything`. 
   ```yaml
   cat <<EOF > ./config.json
   {
     "type": "static",
     "listeners": [
       {
         "sse": {
           "address": "[::]",
           "port": 3000,
           "authn": {
             "jwt": {
               "issuer": [
                 "me"
               ],
               "audience": [
                 "me.com"
               ],
               "local_jwks": {
                 "file_path": "./pub-key"
               }
             }
           }
         }
       }
     ],
     "tracing": {
       "tracer": {
         "otlp": {
           "endpoint": "http://localhost:4317"
         }
       },
       "tags": {
         "user": "@sub",
         "custom-tag": "test"
       }
     },
     "targets": {
       "mcp": [
         {
           "name": "everything",
           "stdio": {
             "cmd": "npx",
            "args": [
               "@modelcontextprotocol/server-everything"
             ]
           }
         }
       ]
     }
   }
   EOF
   ```

3. Run the agentproxy. 
   ```sh
   agentproxy -f ./config.json
   ```

4. Run the MCP Inspector. 
   ```sh
   SERVER_PORT=9000 npx @modelcontextprotocol/inspector
   ```

5. Open the MCP inspector at the address from the output of the previous command, such as `http://localhost:5173?proxyPort=9000`.

6. Connect to the agentproxy. 
   1. Select `SSE` from the **Transport Type** drop down. 
   2. Enter `http://localhost:3000/sse` in the **URL** field. 
   3. Expand the **Authentication** drop down and enter the following JWT token in the **Bearer Token** field. The JWT token includes the `sub: me` claim.  
      ```sh
      eyJhbGciOiJFUzI1NiIsImtpZCI6IlhoTzA2eDhKaldIMXd3a1dreWVFVXhzb29HRVdvRWRpZEVwd3lkX2htdUkiLCJ0eXAiOiJKV1QifQ.eyJhdWQiOiJtZS5jb20iLCJleHAiOjE5MDA2NTAyOTQsImlhdCI6MTc0Mjg2OTUxNywiaXNzIjoibWUiLCJqdGkiOiI3MDViYjM4MTNjN2Q3NDhlYjAyNzc5MjViZGExMjJhZmY5ZDBmYzE1MDNiOGY3YzFmY2I1NDc3MmRiZThkM2ZhIiwibmJmIjoxNzQyODY5NTE3LCJzdWIiOiJtZSJ9.cLeIaiWWMNuNlY92RiCV3k7mScNEvcVCY0WbfNWIvRFMOn_I3v-oqFhRDKapooJZLWeiNldOb8-PL4DIrBqmIQ
      ```
   4. Click **Connect** to connect to the agentproxy. 

7. Access a tool. 
   1. From the menu bar, select **Tools**. 
   2. Click **List Tools**. 
   3. Select the `everything_echo` tool, enter any string in the **message** field, such as `hello`, and click **Run Tool**. Verify that access to the tool is granted and that you see your message echoed. 
      {{< reuse-image src="img/mcp-access-granted.png" >}}

8. Open the [Jaeger UI](http://localhost:16686). 

9. View traces. 
   1. From the **Service** drop down, select `agentproxy`. 
   2. Click **Find Traces**. 
   3. Verify that you can see trace spans for listing the MCP tools (`list_tools`) and calling a tool (`call_tool`).
   4. Expand a trace and verify that you see the `custom-tag=test` and `user=me` tags for each trace span. 
   
   {{< reuse-image src="img/jaeger-traces-tags.png">}} 