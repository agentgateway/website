---
title: Set up targets
weight: 5
description: 
---

Learn how to use the Agent Gateway UI, a configuration file, or the Agent Gateway admin API to create and delete targets. 

## Create targets

You can create targets by using the Agent Gateway UI, a configuration file, or the Agent Gateway admin API. 

{{< tabs items="UI,Configuration file, Admin API" >}}
{{% tab %}}

1. Start your Agent Gateway. 
   ```sh
   agentgateway
   ```

2. [Open the Agent Gateway listener UI](http://localhost:19000/ui/listeners/). You must create a listener before you can create a target. 

3. Add a listener. 
   1. From the listener UI, click **Add Listener**. 
   2. Enter a **Name** for your listener, and configure the **Address** and **Port** that you want your listener to be exposed on. To use an address that is compatible with IPv4 and IPv6, enter `[::]`. 
   
      {{< reuse-image src="img/agentgateway-ui-listener-add.png" width="500px" >}}
   
   3. Click **Add Listener** to save your configuration.

4. [Open the Agent Gateway target UI](http://localhost:19000/ui/targets/). 
   {{< reuse-image src="img/agentgateway-ui-targets-none.png" >}}
   
5. Click **Add Target** and select the `MCP` **Target Type** that you want to configure. To connect to an OpenAPI server, use the MCP target type. 
   {{< reuse-image src="img/agentgateway-ui-target-type.png" width="500px"  >}}
   
6. Confgure your MCP target. 
   1. Select the listener you want to attach to the target. 
   2. Enter a **Target Name**. The name is used as a prefix for all the MCP tools that are exposed on the MCP server.
   3. Select the **>_ stdio** tab and enter the `npx` argument that you want to use to run your MCP server. For example, to run the sample, open source MCP test server, `server-everything`, enter `@modelcontextprotocol/server-everything`. If your server is exposed on a public URL, you can enter that URL in the **SSE** tab instead. 
   
      {{< reuse-image src="img/agentgateway-ui-target-add.png" width="500px" >}}
   6. Click **Add Target** to save your configuration. 

      {{< reuse-image src="img/agentgateway-ui-target-added.png">}}


{{% /tab %}}
{{% tab %}}

1. Create a JSON file that contains your listener configuration. The following example sets up these components: 
   * **Listener**: An SSE listener that listens for incoming traffic on port 3000. 
   * **Target**: The Agent Gateway targets a sample, open source MCP test server, `server-everything`. The server runs the entire MCP stack in a single process and can be used to test, develop, or demo MCP environments. To run the server, you use the standard input/output (`stdio`) capability of the Agent Gateway that allows you specify a command and command arguments that you want to run. In this example, you use the `npx` command utility to run the `@modelcontextprotocol/server-everything` server. 
   ```sh
   cat <<EOF > config.json
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

2. Run the Agent Gateway. 
   ```sh
   agentgateway -f config.json
   ```

3. [Open the Agent Gateway target UI](http://localhost:19000/ui/targets/) and verify that your target is added successfully. 
   {{< reuse-image src="img/agentgateway-ui-targets.png" >}}
   
{{% /tab %}}
{{% tab %}}

1. Start your Agent Gateway. The Agent Gateway automatically exposes its admin API on port 19000. 
   ```sh
   agentgateway
   ```

2. Create an SSE listener by using the `/listeners` endpoint. In the following example, the listener is exposed on port 3000. A listener must be created before you can add a target. 
   ```sh
   curl -X POST -H content-type:application/json http://localhost:19000/listeners -d '{"name": "sse", "sse": {"address": "[::]", "port": 3000}}'
   ```
   
3. Verify that the listener is created. 
   ```sh
   curl http://localhost:19000/listeners
   ```

4. Create an MCP target by using the `/targets/mcp` endpoint. In this example, you create the `everything` target that connects to a sample MCP test server, `server-everything`. To run the server, you use the `npx` command, which allows you to run a Node.js package without installing it. 
   ```sh
   curl -X POST -H content-type:application/json http://localhost:19000/targets/mcp -d '{"name": "everything", "stdio": {"cmd": "npx", "args": ["@modelcontextprotocol/server-everything"]}}'
   ```

5. Verify that the MCP target is created. 
   ```sh
   curl http://localhost:19000/targets/mcp
   ```
   

{{% /tab %}}
{{< /tabs >}}


## Delete targets

{{< tabs items="UI,Configuration file,Admin API" >}}
{{% tab %}}

Remove Agent Gateway targets with the UI. 

1. Run the Agent Gateway from which you want to remove a listener. 
   ```sh
   agentgateway -f config.json
   ```

2. [Open the Agent Gateway targets UI](http://localhost:19000/ui/targets/) and find the target that you want to remove. 
   {{< reuse-image src="img/agentgateway-ui-targets.png" >}}

3. Click the trash icon to remove the target and confirm the deletion. 


{{% /tab %}}
{{% tab %}}

Update the configuration file to remove the target.

1. In your configuration file, remove the target that you want to delete. 
2. Apply the updated configuration file to your Agent Gateway.

   ```sh
   agentgateway -f config.json
   ```

{{% /tab %}}
{{% tab %}}

Use the Agent Gateway admin API to delete targets from your Agent Gateway.

1. Run the Agent Gateway from which you want to remove a target. 
   ```sh
   agentgateway -f config.json
   ```
   
2. List all the MCP targets that are configured on your Agent Gateway and note the name of the target that you want to remove. In the following example, the name of the MCP target is `everything`. 
   ```sh
   curl http://localhost:19000/targets/mcp
   ```
   
   Example output: 
   ```console
   [{"name":"everything","spec":{"Stdio":{"cmd":"npx","args":["@modelcontextprotocol/server-everything"]}}}]
   ```

3. Remove the MCP target from your Agent Gateway. 
   ```sh
   curl -X DELETE curl http://localhost:19000/targets/mcp/everything
   ```
   
4. Verify that the MCP target is removed.
   ```sh
   curl http://localhost:19000/targets/mcp
   ```
   
   Example output: 
   ```console
   []
   ```

5. List all the A2A targets that are configured on your Agent Gateway and note the name of the target that you want to remove. In the following example, the name of the A2A target is `google_adk`. 
   ```sh
   curl http://localhost:19000/targets/a2a
   ```
   
   Example output: 
   ```console
   [{"name":"google-adk","host":"127.0.0.1","port":10002}]%
   ```

6. Remove the A2A target from your Agent Gateway. 
   ```sh
   curl -X DELETE curl http://localhost:19000/targets/a2a/google_adk
   ```

7. Verify that the A2A target is removed. 
   ```sh
   curl http://localhost:19000/targets/a2a
   ```
   
   Example output: 
   ```console
   []
   ```

{{% /tab %}}
{{< /tabs >}}
