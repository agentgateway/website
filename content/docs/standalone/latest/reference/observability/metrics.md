---
title: Metrics
weight: 10
description: 
---

The agentgateway comes with a built-in metrics endpoint that you can use to monitor traffic that is going through the agentgateway. Metrics are automatically collected by the agentgateway for every request that the agentgateway receives. 

## View metrics

1. Follow the [Get started]({{< link-hextra path="/quickstart" >}}) guide to create a configuration for your agentgateway and verify access to an MCP tool. 

2. Open the [agentgateway metrics endpoint](http://localhost:15020/metrics) to view all the metrics that the agentgateway captures. If you tried out an MCP tool earlier, such as the `everything_add` tool, you see the counter for the `tool_calls_total` and `list_calls_total` metrics increase. 
   
   Example output: 
   ```
   # HELP tool_calls The total number of tool calls.
   # TYPE tool_calls counter
   # HELP tool_call_errors The total number of tool call errors.
   # TYPE tool_call_errors counter
   # HELP list_calls The total number of list calls.
   # TYPE list_calls counter
   # HELP read_resource_calls The total number of read resource calls.
   # TYPE read_resource_calls counter
   # HELP get_prompt_calls The total number of get prompt calls.
   # TYPE get_prompt_calls counter
   # HELP agentgateway_xds_connection_terminations The total number of completed connections to xds server (unstable).
   # TYPE agentgateway_xds_connection_terminations counter
   # HELP agentgateway_xds_message Total number of messages received (unstable).
   # TYPE agentgateway_xds_message counter
   # HELP agentgateway_xds_message_bytes Total number of bytes received (unstable).
   # TYPE agentgateway_xds_message_bytes counter
   # UNIT agentgateway_xds_message_bytes bytes
   # HELP agentgateway_requests The total number of HTTP requests sent.
   # TYPE agentgateway_requests counter
   agentgateway_requests_total{gateway="bind/3000",listener="listener0",route="route0",route_rule="unknown",backend="unknown",method="OPTIONS",status="200"} 1
   # EOF
   ```

3. You can optionally send a curl request to the agentgateway metrics endpoint to view the metrics from the command line. 
   ```sh
   curl localhost:15020/metrics -s
   ```

<!-- TODO tags

## Add tags to metrics

You can optionally enrich the metrics that are captured by the agentgateway with tags. Tags are key-value pairs that can have the following format: 
* **Static key-value pair**, where the key and value do not change. For example, use `"custom-tag": "test"` to add this tag to all metrics that are captured by the agentgateway. 
* **Claim-based key-value pair**, where you map the value of a specific JWT claim to a key. For example, if the username is captured in a `sub` claim in your JWT, you can map that username to a `user` tag by using the following syntax `"user": "@sub"`. 

1. Download a sample, local JWT public key file. You use this file to validate JWTs later. 
   ```sh
   curl -o pub-key https://raw.githubusercontent.com/agentgateway/agentgateway/refs/heads/main/manifests/jwt/pub-key
   ```

2. Create a configuration file for your agentgateway. In this example, you configure the following elements: 
   * **Listener**: An HTTP listener that listens for incoming traffic on port 3000. The listener requires a JWT to be present in an `Authorization` header. You use the local JWT public key file to validate the JWT. Only JWTs that include the `sub: me` claim can authenticate with the agentgateway successfully. If the request has a JWT that does not include this claim, the request is denied.
   * **Metrics**: The agentgateway metrics endpoint is configured to inject the `custom-tag: test` tag and to extract the `sub` claim from the JWT token and map it to the `user` tag. 
   * **Target**: The agentgateway targets a sample, open source MCP test server, `server-everything`. 
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
                 "policies": null,
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
     "metrics": {
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

4. Open the [agentgateway UI](http://localhost:15000/ui/) to view your configuration.

5. Connect to the MCP server with the agentgateway UI playground. 
      1. In your `config.yaml` file, add the following CORS policy to allow requests from the agentgateway UI playground. The config automatically reloads when you save the file.
      
      ```yaml
      # yaml-language-server: $schema=https://agentgateway.dev/schema/config
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
   2. In the **Testing** card > **Connection** details > **Bearer Token** field, enter the following JWT token. The JWT token includes the `sub: me` claim that is allowed access to the `everything_echo` tool. 
      ```sh
      eyJhbGciOiJFUzI1NiIsImtpZCI6IlhoTzA2eDhKaldIMXd3a1dreWVFVXhzb29HRVdvRWRpZEVwd3lkX2htdUkiLCJ0eXAiOiJKV1QifQ.eyJhdWQiOiJtZS5jb20iLCJleHAiOjE5MDA2NTAyOTQsImlhdCI6MTc0Mjg2OTUxNywiaXNzIjoibWUiLCJqdGkiOiI3MDViYjM4MTNjN2Q3NDhlYjAyNzc5MjViZGExMjJhZmY5ZDBmYzE1MDNiOGY3YzFmY2I1NDc3MmRiZThkM2ZhIiwibmJmIjoxNzQyODY5NTE3LCJzdWIiOiJtZSJ9.cLeIaiWWMNuNlY92RiCV3k7mScNEvcVCY0WbfNWIvRFMOn_I3v-oqFhRDKapooJZLWeiNldOb8-PL4DIrBqmIQ
      ```
   3. Click **Connect**. The agentgateway UI connects to the target that you configured and retrieves the tools that are exposed on the target. 
   4. Verify that you see a list of **Available Tools**.  
   
      {{< reuse-image src="img/agentgateway-ui-tools-jwt.png" >}}

6. Select the `everything_echo` tool, enter any string in the **message** field, such as `hello world`, and click **Run Tool**. Verify that access to the tool is granted and that you see your message echoed. 
   {{< reuse-image src="img/agentgateway-ui-tool-echo-hello.png" >}}

7. Send a request to the agentgateway metrics endpoint to grab the `tool_calls_total` metric. Verify that you see the `custom-tag=test` and the `user=me` tags. 
   ```sh
   curl http://localhost:15020/metrics -s | grep tool_calls_total
   ```
   
   Example output: 
   ```
   tool_calls_total{server="everything",name="echo",custom-tag="test",user="me"} 1
   ```

-->
