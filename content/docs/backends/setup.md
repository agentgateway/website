---
title: Set up backends
weight: 5
description: 
---

Learn how to use the agentgateway UI or a configuration file to create and delete targets. 

## Create backends

You can create backends by using the agentgateway UI or a configuration file. 

{{< tabs items="UI,Configuration file" >}}
{{% tab %}}

1. Start your agentgateway. 
   ```sh
   agentgateway
   ```

2. [Open the agentgateway listener UI](http://localhost:19000/ui/listeners/). You must create a listener before you can create a target. 

3. Add a listener. 
   1. From the listener UI, click **Add Listener**. 
   2. Enter a **Name** for your listener, select a protocol, and configure the **Address** and **Port** that you want your listener to be exposed on. To use an address that is compatible with IPv4 and IPv6, enter `[::]`. 
   
      {{< reuse-image src="img/agentgateway-ui-listener-add.png" width="500px" >}}
   
   3. Click **Add Listener** to save your configuration.

4. [Open the agentgateway target UI](http://localhost:19000/ui/targets/). 
   {{< reuse-image src="img/agentgateway-ui-targets-none.png" >}}
   
5. Click **Add Target** and choose your **Target Type**, such as `MCP`. 

   {{< callout type="info">}} 
   To connect to an OpenAPI server, use the `MCP `target type. 
   {{< /callout >}}
   {{< reuse-image src="img/agentgateway-ui-target-type.png" width="500px"  >}}
   
6. Confgure your MCP target. 
   1. Select the listener you want to attach to the target. 
   2. Enter a **Target Name**. The name is used as a prefix for all the MCP tools that are exposed on the MCP server.
   3. Select the standard input/output (**>_ stdio**) tab that allows you to specify a command and command arguments to run your MCP server. In this example, you use the `npx` command utility to run the `@modelcontextprotocol/server-everything` server. If your server is exposed on a public URL, you can enter that URL in the **SSE** tab instead. 
   
      {{< reuse-image src="img/agentgateway-ui-target-add.png" width="500px" >}}
   4. Click **Add Target** to save your configuration. 

      {{< reuse-image src="img/agentgateway-ui-target-added.png">}}


{{% /tab %}}
{{% tab %}}

1. Create a configuration file for your agentgateway. In this example, the agentgateway is configured as follows: 
   * **Listener**: An SSE listener is configured and exposed on port 3000. 
   * **Backend**: The agentgateway targets a sample, open source MCP test server, `server-everything`. 
   ```yaml
   cat <<EOF > config.yaml
   {{< github url="https://raw.githubusercontent.com/agentgateway/agentgateway/refs/heads/main/examples/basic/config.yaml" >}}
   EOF
   ```

2. Run the agentgateway. 
   ```sh
   agentgateway -f config.yaml
   ```

3. [Open the agentgateway target UI](http://localhost:19000/ui/targets/) and verify that your target is added successfully. 
   {{< reuse-image src="img/agentgateway-ui-targets.png" >}}
   
{{% /tab %}}
{{< /tabs >}}


## Delete targets

{{< tabs items="UI,Configuration file" >}}
{{% tab %}}

Remove agentgateway targets with the UI. 

1. Run the agentgateway from which you want to remove a listener. 
   ```sh
   agentgateway -f config.yaml
   ```

2. [Open the agentgateway targets UI](http://localhost:19000/ui/targets/) and find the target that you want to remove. 
   {{< reuse-image src="img/agentgateway-ui-targets.png" >}}

3. Click the trash icon to remove the target and confirm the deletion. 


{{% /tab %}}
{{% tab %}}

Update the configuration file to remove the target.

1. Remove the target from your configuration file. 
2. Apply the updated configuration file to your agentgateway.

   ```sh
   agentgateway -f config.yaml
   ```

{{% /tab %}}
{{< /tabs >}}
