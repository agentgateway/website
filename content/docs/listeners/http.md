---
title: HTTP listeners
weight: 10
description: Configure HTTP listeners for agentgateway.
--- 

You can use the built-in agentgateway UI or a configuration file to create, update, and delete HTTP listeners. 

## Before you begin

{{< reuse "docs/snippets/prereq-agentgateway.md" >}}

## Create listeners

Set up a listener on your agentgateway. 

{{< tabs items="UI,Configuration file" >}}
{{% tab %}}

1. Start your agentgateway. 
   ```sh
   agentgateway 
   ```

2. [Open the agentgateway listener UI](http://localhost:15000/ui/listeners/). 
   {{< reuse-image src="img/agentgateway-ui-listener-none.png" >}}

3. Click **Add Bind**. 
4. Enter a **Port** number such as `3000` and then click **Add Bind**.
   {{< reuse-image src="img/ui-listener-add-bind.png" >}}
5. Expand the port that you just created and click **Add Listener**.
   {{< reuse-image src="img/ui-listener-add.png">}}
6. For your listener, configure the details.
   * Name: If you omit this, a name is generated for you.
   * Gateway Name: An optional field to group together listeners for ease of management, such as listeners for the same app or team.
   * Target Bind: The port bind that you set up in the previous step.
   * Protocol: The protocol that you want your listener to use, such as `HTTP`.
   * Hostname: The hostname that the listener binds to, which can include a wildcard `*`. To use an address that is compatible with IPv4 and IPv6, enter `[::]`.
   * Click **Add Listener** to save your configuration.
   
   {{< reuse-image src="img/ui-listener-add-details.png" >}}

{{% /tab %}}
{{% tab %}}

1. Download a configuration file that contains your listener configuration. 
   
   ```sh
   curl -L https://raw.githubusercontent.com/agentgateway/agentgateway/refs/heads/main/examples/basic/config.yaml -o config.yaml
   ```

2. Review the configuration file. The example sets up an HTTP listener with the MCP protocol that listens for incoming traffic on port 3000. 
   ```
   cat config.yaml
   ```

   {{% github-yaml url="https://raw.githubusercontent.com/agentgateway/agentgateway/refs/heads/main/examples/basic/config.yaml" %}}

3. Run the agentgateway. 
   ```sh
   agentgateway -f config.yaml
   ```

4. [Open the agentgateway listener UI](http://localhost:15000/ui/listeners/) and verify that your listener is added successfully. 
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
   agentgateway -f config.yaml
   ```

2. [Open the agentgateway listener UI](http://localhost:15000/ui/listeners/) and find the listener that you want to remove. 
   {{< reuse-image src="img/agentgateway-ui-listener-basic.png" >}}

3. Click the trash icon and then **Delete** to remove the listener. 
   {{< reuse-image src="img/ui-listener-delete.png" >}}

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
