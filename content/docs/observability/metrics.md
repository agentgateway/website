---
title: Metrics
weight: 10
description: 
---

The agentgateway comes with a built-in metrics endpoint that you can use to monitor traffic that is going through the agentgateway. Metrics are automatically collected by the agentgateway for every request that the agentgateway receives. 

## View metrics

1. Follow the [Get started](/docs/quickstart) guide to create a configuration for your agentgateway and verify access to an MCP tool. 

2. Open the [agentgateway metrics endpoint](http://localhost:9091/metrics) to view all the metrics that the agentgateway captures. If you tried out an MCP tool earlier, such as the `everything_add` tool, you see the counter for the `tool_calls_total` and `list_calls_total` metrics increase. 
   
   Example output: 
   ```
   # HELP tool_calls The total number of tool calls.
   # TYPE tool_calls counter
   tool_calls_total{server="everything",name="add"} 1
   # HELP tool_call_errors The total number of tool call errors.
   # TYPE tool_call_errors counter
   # HELP list_calls The total number of list calls.
   # TYPE list_calls counter
   list_calls_total{resource_type="tool"} 1
   # HELP read_resource_calls The total number of read resource calls.
   # TYPE read_resource_calls counter
   # HELP get_prompt_calls The total number of get prompt calls.
   # TYPE get_prompt_calls counter
   # HELP agent_calls The total number of agent calls.
   # TYPE agent_calls counter
   # EOF
   ```

3. You can optionaly send a curl request to the agentgateway metrics endpoint to view the metrics from the command line. 
   ```sh
   curl localhost:9091/metrics -s
   ```

## Add tags to metrics

You can optionally enrich the metrics that are captured by the agentgateway with tags. Tags are key-value pairs that can have the following format: 
* **Static key-value pair**, where the key and value do not change. For example, use `"custom-tag": "test"` to add this tag to all metrics that are captured by the agentgateway. 
* **Claim-based key-value pair**, where you map the value of a specific JWT claim to a key. For example, if the username is captured in a `sub` claim in your JWT, you can map that username to a `user` tag by using the following syntax `"user": "@sub"`. 

1. Download a sample, local JWT public key file. You use this file to validate JWTs later. 
   ```sh
   curl -o pub-key https://raw.githubusercontent.com/agentgateway/agentgateway/refs/heads/main/manifests/jwt/pub-key
   ```

2. Create a configuration file for your agentgateway. In this example, you configure the following elements: 
   * **Listener**: An SSE listener that listens for incoming traffic on port 3000. The listener requires a JWT to be present in an `Authorization` header. You use the local JWT public key file to validate the JWT. Only JWTs that include the `sub: me` claim can authenticate with the agentgateway successfully. If the request has a JWT that does not include this claim, the request is denied.
   * **Metrics**: The agentgateway metrics endpoint is configured to inject the `custom-tag: test` tag and to extract the `sub` claim from the JWT token and map it to the `user` tag. 
   * **Target**: The agentgateway targets a sample, open source MCP test server, `server-everything`. 
   ```yaml
   cat <<EOF > ./config.json
   {
     "type": "static",
     "listeners": [
       {
         "name": "sse",
         "protocol": "MCP",
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
     "metrics": {
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

3. Run the agentgateway. 
   ```sh
   agentgateway -f config.json
   ```

4. Open the [agentgateway UI](http://localhost:19000/ui/) to view your listener and target configuration.

5. Connect to the MCP server with the agentgateway UI playground. 
   1. Go to the agentgateway UI [**Playground**](http://localhost:19000/ui/playground/).
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

7. Send a request to the agentgateway metrics endpoint to grab the `tool_calls_total` metric. Verify that you see the `custom-tag=test` and the `user=me` tags. 
   ```sh
   curl http://localhost:9091/metrics -s | grep tool_calls_total
   ```
   
   Example output: 
   ```
   tool_calls_total{server="everything",name="echo",custom-tag="test",user="me"} 1
   ```
