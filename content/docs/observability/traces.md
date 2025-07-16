---
title: Traces
weight: 20
description:
---

The agentgateway integrates with Jaeger as the tracing platform. [Jaeger](https://www.jaegertracing.io) is an open source tool that helps you follow the path of a request as it is forwarded between agents. The chain of events and interactions are captured by an OpenTelemetry pipeline that is configured to send traces to the Jaeger agent. You can then visualize the traces by using the Jaeger UI. 

## Set up Jaeger

Use [`docker compose`](https://docs.docker.com/compose/install/linux/) to spin up a Jaeger instance with the following components: 
* An OpenTelemetry collector that receives traces from the agentgateway. The collector is exposed on `http://localhost:4317`. 
* A Jaeger agent that receives the collected traces. The agent is exposed on `http://localhost:14268`. 
* A Jaeger UI that is exposed on `http://localhost:16686`. 

```sh
docker compose -f - up -d <<EOF
{{< github url="https://raw.githubusercontent.com/agentgateway/agentgateway/refs/heads/main/examples/telemetry/docker-compose.yaml" >}}
EOF
```

## Configure the agentgateway

1. Download a telemetry configuration for your agentgateway.

   ```yaml
   curl -L https://raw.githubusercontent.com/agentgateway/agentgateway/refs/heads/main/examples/telemetry/config.yaml -o config.yaml
   ```

2. Review the configuration file. 

   ```
   cat config.yaml
   ```

   {{% github-yaml url="https://raw.githubusercontent.com/agentgateway/agentgateway/refs/heads/main/examples/telemetry/config.yaml" %}}

   * **Listener**: An HTTP listener that listens for incoming traffic on port 3000. 
   * **Traces**: The agentgateway is configured to send traces to the OpenTelemetry collector that you exposed on `http://localhost:4317`. 
   * **Backend**: The agentgateway targets a sample, open source MCP test server, `server-everything`. 

3. Optional: To use the agentgateway UI playground later, add the following CORS policy to your `config.yaml` file. The config automatically reloads when you save the file.
      
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
            backends:
      ...
      ```

4. Run the agentgateway. 
   ```sh
   agentgateway -f config.json
   ```

## Verify traces

1. Open the [agentgateway UI](http://localhost:15000/ui/) to view your listener and target configuration.

2. Connect to the MCP server with the agentgateway UI playground. 
   
   1. From the navigation menu, click [**Playground**](http://localhost:15000/ui/playground/).
      
      {{< reuse-image src="img/agentgateway-ui-playground.png" >}}

   2. In the **Testing** card, review your **Connection** details and click **Connect**. The agentgateway UI connects to the target that you configured and retrieves the tools that are exposed on the target. 

   3. Verify that you see a list of **Available Tools**. 
   
      {{< reuse-image src="img/ui-playground-tools.png" >}}

3. Verify access to a tool. 
   1. From the **Available Tools** list, select the `echo` tool. 
   2. In the **message** field, enter any string, such as `hello world`, and click **Run Tool**. 
   3. Verify that you see your message echoed in the **Response** card. 
   
      {{< reuse-image src="img/agentgateway-ui-tool-echo-hello.png" >}}

4. Open the [Jaeger UI](http://localhost:16686). 

5. View traces. 
   1. From the **Service** drop down, select `agentgateway`. 
   2. Click **Find Traces**. 
   3. Verify that you can see trace spans for listing the MCP tools (`list_tools`) and calling a tool (`call_tool`).
   
   {{< reuse-image src="img/jaeger-traces.png">}}

## Cleanup

Stop and remove the Jaeger container.

```sh
docker stop jaeger
docker rm jaeger
```

<!-- TODO tags

## Add tags to traces

You can optionally enrich the traces that are captured by the agentgateway with tags. Tags are key-value pairs that can have the following format: 
* **Static key-value pair**, where the key and value do not change. For example, use `"custom-tag": "test"` to add this tag to all traces that are captured by the agentgateway. 
* **Claim-based key-value pair**, where you map the value of a specific JWT claim to a key. For example, if the username is captured in a `sub` claim in your JWT, you can map that username to a `user` tag by using the following syntax `"user": "@sub"`. 

1. Download a sample, local JWT public key file. You use this file to validate JWTs later. 
   ```sh
   https://raw.githubusercontent.com/agentgateway/agentgateway/refs/heads/main/manifests/jwt/pub-key
   ```

2. Create a configuration file for your agentgateway. In this example, you configure the following elements: 
   * **Listener**: An HTTP listener that listens for incoming traffic on port 3000. The listener requires a JWT to be present in an `Authorization` header. You use the local JWT public key file to validate the JWT. Only JWTs that include the `sub: me` claim can authenticate with the agentgateway successfully. If the request has a JWT that does not include this claim, the request is denied.
   * **Traces**: The agentgateway is configured to send traces to the OpenTelemetry collector that you exposed on `http://localhost:4317`. In addition, the agentgateway is configured to inject the `custom-tag: test` tag and to extract the `sub` claim from the JWT token and map it to the `user` tag. 
   * **Backend**: The agentgateway targets a sample, open source MCP test server, `server-everything`. 
   ```json
   cat <<EOF > ./config.json
   {
     "binds": [
       {
         "port": 3000,
         "listeners": [
           {
             "name": "sse",
             "protocol": "HTTP",
             "hostname": null,
             "routes": [
               {
                 "name": null,
                 "ruleName": null,
                 "hostnames": [],
                 "matches": [
                   {
                     "path": {
                       "pathPrefix": "/"
                     }
                   }
                 ],
                 "policies": {
                   "jwtAuth": {
                     "issuer": "me",
                     "audiences": ["me.com"],
                     "jwks": {
                       "file": "./pub-key"
                     }
                   }
                 },
                 "backends": [
                   {
                     "mcp": {
                       "targets": [
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
                 ]
               }
             ],
             "tls": null
           }
         ]
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
     }
   }
   EOF
   ```

3. Run the agentgateway. 
   ```sh
   agentgateway -f config.json
   ```

4. Open the [agentgateway UI](http://localhost:15000/ui/) to view your listener and target configuration.

5. Connect to the MCP server with the agentgateway UI playground. 
   1. Go to the agentgateway UI [**Playground**](http://localhost:15000/ui/playground/).
   2. In the **Connection Settings** card, select your **Listener Endpoint**. 
   3. In the **Bearer Token** field, enter the following JWT token. The JWT token includes the `sub: me` claim that is allowed access to the `everything_echo` tool. 
      ```sh
      eyJhbGciOiJFUzI1NiIsImtpZCI6IlhoTzA2eDhKaldIMXd3a1dreWVFVXhzb29HRVdvRWRpZEVwd3lkX2htdUkiLCJ0eXAiOiJKV1QifQ.eyJhdWQiOiJtZS5jb20iLCJleHAiOjE5MDA2NTAyOTQsImlhdCI6MTc0Mjg2OTUxNywiaXNzIjoibWUiLCJqdGkiOiI3MDViYjM4MTNjN2Q3NDhlYjAyNzc5MjViZGExMjJhZmY5ZDBmYzE1MDNiOGY3YzFmY2I1NDc3MmRiZThkM2ZhIiwibmJmIjoxNzQyODY5NTE3LCJzdWIiOiJtZSJ9.cLeIaiWWMNuNlY92RiCV3k7mScNEvcVCY0WbfNWIvRFMOn_I3v-oqFhRDKapooJZLWeiNldOb8-PL4DIrBqmIQ
      ```
   4. Click **Connect**. The agentgateway UI connects to the target that you configured and retrieves the tools that are exposed on the target. 
   5. Verify that you see a list of **Available Tools**.  
   
      {{< reuse-image src="img/agentgateway-ui-tools-jwt.png" >}}

6. Select the `everything_echo` tool, enter any string in the **message** field, such as `hello world`, and click **Run Tool**. Verify that access to the tool is granted and that you see your message echoed. 
   {{< reuse-image src="img/agentgateway-ui-tool-echo-hello.png" >}}

7. Open the [Jaeger UI](http://localhost:16686). 

8. View traces. 
   1. From the **Service** drop down, select `agentgateway`. 
   2. Click **Find Traces**. 
   3. Verify that you can see trace spans for listing the MCP tools (`list_tools`) and calling a tool (`call_tool`).
   4. Expand a trace and verify that you see the `custom-tag=test` and `user=me` tags for each trace span. 
   
   {{< reuse-image src="img/jaeger-traces-tags.png">}} 

-->
