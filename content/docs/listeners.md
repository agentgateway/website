---
title: Listeners
weight: 30
description: You can use the Agent Gateway UI or admin API to configure listeners.
next: /docs/targets
--- 

You can use the built-in Agent Gateway UI, a configuration file, or the admin API to create, update, and delete listeners. 

## Create listeners

Set up an SSE listener on your Agent Gateway. 

{{< tabs items="UI,Configuration file,Admin API," >}}
{{% tab %}}

1. Start your Agent Gateway. 
   ```sh
   agentgateway 
   ```

2. [Open the Agent Gateway listener UI](http://localhost:19000/ui/listeners/). 
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
   cat <<EOF > ./config.json
   {
     "type": "static",
     "listeners": [
       {
         "name": "sse",
         "protocol": "MCP",
         "sse": {
           "address": "[::]",
           "port": 3000
         }
       }
     ]
   } 
   EOF
   ```

2. Run the Agent Gateway. 
   ```sh
   agentgateway -f config.json
   ```

2. [Open the Agent Gateway listener UI](http://localhost:19000/ui/listeners/) and verify that your listener is added successfully. 
   {{< reuse-image src="img/agentgateway-ui-listener-basic.png" >}}
   
{{% /tab %}}
{{% tab %}}

Use the Agent Gateway admin API to configure an SSE listener on your Agent Gateway.

1. Start your Agent Gateway. The Agent Gateway automatically exposes its admin API on port 19000. 
   ```sh
   agentgateway 
   ```

2. Create an SSE listener by using the `/listeners` endpoint. In the following example, the listener is configured with the MCP protocol and exposed on port 3000. 
   ```sh
   curl -X POST -H content-type:application/json http://localhost:19000/listeners -d '{"name":"sse","protocol":"MCP","sse":{"address":"[::]","port":3000,"rbac":[]}}'
   ```
   
3. Verify that the listener is created. 
   ```sh
   curl http://localhost:19000/listeners
   ```
   
   Example output: 
   ```console
   [{"name":"sse","protocol":"MCP","sse":{"address":"[::]","port":3000,"rbac":[]}}]
   ```
{{% /tab %}}
{{< /tabs >}}

## Delete listeners

Remove Agent Gateway listeners by using the UI or admin API. 

{{< tabs items="UI,Configuration file,Admin API" >}}
{{% tab %}}

Remove Agent Gateway listeners with the UI. 

1. Run the Agent Gateway from which you want to remove a listener. 
   ```sh
   agentgateway -f config.json
   ```

2. [Open the Agent Gateway listener UI](http://localhost:19000/ui/listeners/) and find the listener that you want to remove. 
   {{< reuse-image src="img/agentgateway-ui-listener-basic.png" >}}

3. Click the trash icon to remove the listener and confirm the deletion. 


{{% /tab %}}
{{% tab %}}

Update the configuration file to remove the listener.

1. Remove the listener from your configuration file.
2. Apply the updated configuration file to your Agent Gateway.

   ```sh
   agentgateway -f config.json
   ```

{{% /tab %}}
{{% tab %}}

Use the Agent Gateway admin API to delete listeners from your Agent Gateway.

1. Run the Agent Gateway from which you want to remove a listener. 
   ```sh
   agentgateway -f config.json
   ```

2. List the listeners that are currently configured on your Agent Gateway and note the name of the listener that you want to delete. In the following example, the listener is named `sse`. 
   ```sh
   curl http://localhost:19000/listeners
   ```
   
   Example output: 
   ```console
   [{"name":"sse","protocol":"MCP","sse":{"address":"[::]","port":3000,"rbac":[]}}]
   ```

3. Delete the listener. The following example shows how to delete the `sse` listener. 
   ```sh
   curl -X DELETE http://localhost:19000/listeners/sse
   ```
   
4. Verify that the listener is removed. 
   ```sh
   curl http://localhost:19000/listeners
   ```
   
   Example output: 
   ```console
   []
   ```

{{% /tab %}}
{{< /tabs >}}