---
title: Get started
weight: 10
description: Deploy a basic agentproxy on your machine. 
---

PAGE IN PROGRESS

In this guide, you deploy a sample agentproxy on your local machine that is configured to access an open source MCP test server, `server-everything`. 

## Before you begin

INSTALL SCRIPT
   
## Set up an agentproxy

{{< tabs items="Run the agentproxy CLI directly,Kubernetes" >}}
{{% tab %}}

1. Review that `basic` agentproxy configuration. 
   ```sh
   cat examples/basic/config.json
   ```
   
   Example output:
   ```yaml
   cat <<\EOF > ./basic.json
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
   ```
   
   | Configuration | Description | 
   | -- | -- | 
   | `listeners.sse` | The SSE listener configuration with the address and port for the agentproxy to bind to. | 
   | `targets.mcp` | The MCP tool server that you want to access via the agentproxy. In this example, you connect to an open-source MCP test server that was designed to demonstrate and exercise the full range of MCP features. All its tools are automatically accessible via the agentproxy. | 
   
3. Run the agentproxy. 
   ```sh
   agentproxy -f examples/basic/config.json
   ```
   
   Example output: 
   ```
   2025-04-16T20:19:36.449164Z  INFO agentproxy: Reading config from file: basic.json
   2025-04-16T20:19:36.449580Z  INFO insert_target: agentproxy::xds: inserted target: everything
   2025-04-16T20:19:36.449595Z  INFO agentproxy::r#static: local config initialized num_mcp_targets=1 num_a2a_targets=0
   2025-04-16T20:19:36.449874Z  INFO agentproxy::inbound: serving sse on [::]:3000
   ```

{{% /tab %}}
{{% tab %}}
{{% /tab %}}
{{< /tabs >}}

## Explore the agentproxy UI


## Access MCP tools

1. Open the MCP inspector. 
   ```sh
   SERVER_PORT=9000 npx @modelcontextprotocol/inspector 
   ```
   
   Example output: 
   ```
   Starting MCP inspector...
   Proxy server listening on port 9000
   New SSE connection
   Query parameters: { transportType: 'sse', url: 'http://localhost:3000/sse' }
   SSE transport: url=http://localhost:3000/sse, headers=Accept,authorization
   Connected to SSE transport
   Connected MCP client to backing server transport
   Created web app transport
   Created web app transport
   Set up MCP proxy

   🔍 MCP Inspector is up and running at http://localhost:5173?proxyPort=9000 🚀
   ```
   
2. Open the MCP inspector at the address from the output of the previous command, such as [http://localhost:5173?proxyPort=9000](http://localhost:5173?proxyPort=9000). 

3. Connect to the agentproxy to access the tools that are exposed on the MCP test server. 
   1. Switch the **Transport Type** to `SSE`.
   2. Change the URL to `http://localhost:3000/sse`, which represents the address that the agentproxy is exposed on. 
   3. Click **Connect** to connect to the agentproxy. 

4. Access an MCP tool. 
   1. In the MCP inspector, go to **Tools**.
   2. Click **List Tools** to show the tools that the agentproxy has access to. 
   3. Select the **everything_echo** tool. 
   4. In the **message** field, enter any string, such as `This is a sample agentproxy setup.`. 
   5. Click **Run Tool** to execute the tool. 
   6. Verify that your string is echoed back in 
   
   {{< reuse-image src="img/agentproxy-basic.png" >}}

