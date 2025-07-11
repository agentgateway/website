---
title: Listeners
weight: 30
description: Configure listeners for agentgateway.
next: /docs/targets
--- 

You can use the built-in agentgateway UI or a configuration file to create, update, and delete listeners. 

## Create listeners

Set up an SSE listener on your agentgateway. 

{{< tabs items="UI,Configuration file" >}}
{{% tab %}}

1. Start your agentgateway. 
   ```sh
   agentgateway 
   ```

2. [Open the agentgateway listener UI](http://localhost:19000/ui/listeners/). 
   {{< reuse-image src="img/agentgateway-ui-listener-none.png" >}}

3. Click **Add Listener**. 
4. Enter a **Name** for your listener, select a protocol, and configure the **Address** and **Port** that you want your listener to be exposed on. To use an address that is compatible with IPv4 and IPv6, enter `[::]`. 
   
   {{< reuse-image src="img/agentgateway-ui-listener-add.png" width="500px" >}}

5. Click **Add Listener** to save your configuration. 
   
   {{< reuse-image src="img/agentgateway-ui-listener-basic.png" >}}

   
{{% /tab %}}
{{% tab %}}

1. Create a JSON file that contains your listener configuration. The following example sets up an SSE listener with the MCP protocol that listens for incoming traffic on port 3000. 
   ```yaml
   cat <<EOF > config.yaml
   {{< github url="https://raw.githubusercontent.com/agentgateway/agentgateway/refs/heads/main/examples/basic/config.yaml" >}}
   EOF
   ```

2. Run the agentgateway. 
   ```sh
   agentgateway -f config.yaml
   ```

2. [Open the agentgateway listener UI](http://localhost:19000/ui/listeners/) and verify that your listener is added successfully. 
   {{< reuse-image src="img/agentgateway-ui-listener-basic.png" >}}
   
{{% /tab %}}
{{< /tabs >}}

## Delete listeners

Remove agentgateway listeners by using the UI or deleting the configuration file. 

{{< tabs items="UI,Configuration file" >}}
{{% tab %}}

Remove agentgateway listeners with the UI. 

1. Run the agentgateway from which you want to remove a listener. 
   ```sh
   agentgateway -f config.json
   ```

2. [Open the agentgateway listener UI](http://localhost:19000/ui/listeners/) and find the listener that you want to remove. 
   {{< reuse-image src="img/agentgateway-ui-listener-basic.png" >}}

3. Click the trash icon to remove the listener and confirm the deletion. 


{{% /tab %}}
{{% tab %}}

Update the configuration file to remove the listener.

1. Remove the listener from your configuration file.
2. Apply the updated configuration file to your agentgateway.

   ```sh
   agentgateway -f config.yaml
   ```

{{% /tab %}}
{{< /tabs >}}
