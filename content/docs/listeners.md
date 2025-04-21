---
title: Listeners
weight: 30
description: You can use the agentproxy UI or admin API to configure listeners. 
--- 

You can use the built-in agentproxy UI, a configuration file, or the admin API to create, update, and delete listeners. 

## Create listeners

Set up an SSE listener on your agentproxy. 

{{< tabs items="UI,Configuration file,Admin API," >}}
{{% tab %}}

1. Start your agentproxy. 
   ```sh
   agentproxy 
   ```

2. [Open the agentproxy listener UI](http://localhost:19000/ui/listeners/). 
   {{< reuse-image src="img/agentproxy-ui-listener.png" >}}

3. Click **Add Listener**. 
4. Enter a **Name** for your listener, and configure the **Address** and **Port** that you want your listener to be exposed on. To use an address that is compatible with IPv4 and IPv6, enter `[::]`. 
   
   {{< reuse-image src="img/agentproxy-ui-listener-add.png" width="500px" >}}

5. Click **Add Listener** to save your configuration. 
   
   {{< reuse-image src="img/agentproxy-ui-listener-added.png">}}

   
{{% /tab %}}
{{% tab %}}

1. Create a JSON file that contains your listener configuration. The following example sets up an SSE listener that listens for incoming traffic on port 3000. 
   ```json
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
     ]
   } 
   EOF
   ```

2. Run the agentproxy. 
   ```sh
   agentproxy -f config.json
   ```

2. [Open the agentproxy listener UI](http://localhost:19000/ui/listeners/) and verify that your listener is added successfully. 
   {{< reuse-image src="img/agentproxy-ui-listener.png" >}}
   
{{% /tab %}}
{{% tab %}}

Use the agentproxy admin API to configure an SSE listener on your agentproxy 

1. Start your agentproxy. The agentproxy automatically exposes its admin API on port 19000. 
   ```sh
   agentproxy 
   ```

2. Create an SSE listener by using the `/listeners` endpoint. In the following example, the listener is exposed on port 3000. 
   ```sh
   curl -X POST -H content-type:application/json http://localhost:19000/listeners -d '{"name": "sse", "sse": {"address": "[::]", "port": 3000}}'
   ```
   
3. Verify that the listener is created. 
   ```sh
   curl http://localhost:19000/listeners
   ```
   
   Example output: 
   ```console
   [{"name":"sse","sse":{"address":"0.0.0.0","port":3000}}]% 
   ```
{{% /tab %}}
{{< /tabs >}}

## Delete listeners

Remove agentproxy listeners by using the UI or admin API. 

{{< tabs items="UI,Configuration file,Admin API" >}}
{{% tab %}}

Remove agentproxy listeners with the UI. 

1. Run the agentproxy from which you want to remove a listener. 
   ```sh
   agentproxy -f config.json
   ```

2. [Open the agentproxy listener UI](http://localhost:19000/ui/listeners/) and find the listener that you want to remove. 
   {{< reuse-image src="img/agentproxy-ui-listener.png" >}}

3. Click the trash icon to remove the listener and confirm the deletion. 


{{% /tab %}}
{{% tab %}}

If you use a configuration file to configure your agentproxy, you can remove the listener from the file. Then, run your agentproxy with the updated configuration. 

```sh
agentproxy -f config.json
```

{{% /tab %}}
{{% tab %}}

Use the agentproxy admin API to delete listeners from your agentproxy.

1. Run the agentproxy from which you want to remove a listener. 
   ```sh
   agentproxy -f config.json
   ```

2. List the listeners that are currently configured on your agentproxy and note the name of the listener that you want to delete. In the following example, the listener is named `sse`. 
   ```sh
   curl http://localhost:19000/listeners
   ```
   
   Example output: 
   ```console
   [{"name":"sse","sse":{"address":"0.0.0.0","port":3000}}]%
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