---
title: Backends
weight: 30
description: 
prev: /docs/configuration/listeners
---

Learn how to use the agentgateway UI or a configuration file to create and delete targets. 

## Before you begin

1. [Set up a listener](/docs/configuration/listeners).
2. [Create a route](/docs/routes) on the listener.
3. {{< reuse "docs/snippets/prereq-agentgateway.md" >}}

## Create backends

You can create backends by using the agentgateway UI or a configuration file. 

{{< tabs items="UI,Configuration file" >}}
{{% tab %}}

1. Start your agentgateway. 
   ```sh
   agentgateway
   ```

2. [Open the agentgateway target UI](http://localhost:15000/ui/backends/). 
   {{< reuse-image src="img/ui-backends-none.png" >}}
   
3. Click **Add Backend** and configure your backend details, such as follows:

   * Backend Type: `MCP`
   * Name: `default`
   * Weight: `1`
   * Route: Select the route on the listener that you want to use to route to the backend.
   * Click **Add Target**.
   * Target Name: `everything`
   * Target Type: From the dropdown, select the target type that you want to use, such as `Stdio`.
   * Command: `npx`
   * Arguments: `@modelcontextprotocol/server-everything`
   * Environment Variables: Optionally add any environment variables that you need the target to run.
   * To add more targets, click **Add Target** and repeat the previous steps.
   * Click **Add MCP Backend** to save your configuration.

{{< callout type="info">}} 
To connect to an OpenAPI server, use the `MCP `target type. 
{{< /callout >}}
   {{< reuse-image src="img/ui-backend-details.png"  >}}

{{% /tab %}}
{{% tab %}}

1. Download a configuration file for your agentgateway.
   ```yaml
   curl -L https://raw.githubusercontent.com/agentgateway/agentgateway/refs/heads/main/examples/basic/config.yaml -o config.yaml
   ```

2. Review the configuration file.

   ```
   cat config.yaml
   ```

   {{% github-yaml url="https://raw.githubusercontent.com/agentgateway/agentgateway/refs/heads/main/examples/basic/config.yaml" %}}

   {{< reuse "docs/snippets/review-table.md" >}}

   {{< reuse "docs/snippets/example-basic-mcp.md" >}}

3. Run the agentgateway. 
   ```sh
   agentgateway -f config.yaml
   ```

4. [Open the agentgateway backend UI](http://localhost:15000/ui/backends/) and verify that your target is added successfully. 
   {{< reuse-image src="img/agentgateway-ui-backends.png" >}}
   
{{% /tab %}}
{{< /tabs >}}


## Delete targets

{{< tabs items="UI,Configuration file" >}}
{{% tab %}}

Remove agentgateway backends with the UI. 

1. Run the agentgateway from which you want to remove a backend. 
   ```sh
   agentgateway -f config.yaml
   ```

2. [Open the agentgateway backends UI](http://localhost:15000/ui/backends/) and find the backend that you want to remove. 
   {{< reuse-image src="img/agentgateway-ui-backends.png" >}}

3. Click the trash icon to remove the backend. 

{{% /tab %}}
{{% tab %}}

Update the configuration file to remove the backend.

1. Remove the backend from your configuration file. 
2. Apply the updated configuration file to your agentgateway.

   ```sh
   agentgateway -f config.yaml
   ```

{{% /tab %}}
{{< /tabs >}}
