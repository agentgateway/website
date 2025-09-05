---
title: Routes
weight: 40
description: Configure routes on listeners for agentgateway.
next: /docs/configuration/traffic-management
---

Routes are the entry points for traffic to your agentgateway. They are configured on listeners and are used to route traffic to backends.

You can use the built-in agentgateway UI or a configuration file to create, update, and delete routes. 

## Before you begin

1. {{< reuse "docs/snippets/prereq-agentgateway.md" >}}
2. [Set up a listener](/docs/listeners).

## Create routes

Set up a route on your listener. 

{{< tabs items="UI,Configuration file" >}}
{{% tab %}}

1. Start your agentgateway. 
   ```sh
   agentgateway 
   ```

2. [Open the agentgateway route UI](http://localhost:15000/ui/routes/). 
   {{< reuse-image src="img/ui-routes-none.png" >}}

3. Click **Add Route** and configure a route such as follows:
   * Name: An optional name for the route.
   * Rule Name: An optional name for the matching rules of the route.
   * Target Listener: Select the listener that you previously created. The Route Type is automatically determined based on the listener protocol.
   * Hostnames: Add the hostnames that the route serves traffic on.
   * Path Match Type: Select the type of path matching that you want to use, such as `Path Prefix`, and then configure its details. For more options, see the [Request matching](/docs/traffic-management/matching) guide.
   * Headers: Optional header configuration, such as the authorization header.
   * HTTP Methods: Optional HTTP methods to allow, such as `GET, POST, PUT`.
   * Query Parameters: Optional query parameters to allow, such as `version=v1`.
   * Click **Add HTTP Route** to continue.
   {{< reuse-image src="img/ui-routes-add.png" >}}

{{% /tab %}}
{{% tab %}}

1. Download a configuration file that contains your route configuration.

   ```sh
   curl -L https://raw.githubusercontent.com/agentgateway/agentgateway/refs/heads/main/examples/basic/config.yaml -o config.yaml
   ```

2. Review the configuration file. The example sets up an HTTP listener on port 3000 that matches on all hosts. For more options, see the [Request matching](/docs/traffic-management/matching) guide.
   
   ```yaml
   cat config.yaml
   ```

   {{% github-yaml  url="https://raw.githubusercontent.com/agentgateway/agentgateway/refs/heads/main/examples/basic/config.yaml" %}}

3. Run the agentgateway. 
   ```sh
   agentgateway -f config.yaml
   ```

4. [Open the agentgateway listener UI](http://localhost:15000/ui/routes/) and verify that your route is added successfully. 
   {{< reuse-image src="img/agentgateway-ui-routes.png" >}}
   
{{% /tab %}}
{{< /tabs >}}

## Delete routes

Remove agentgateway routes by using the UI or deleting the configuration file. 

{{< tabs items="UI,Configuration file" >}}
{{% tab %}}

Remove agentgateway routes with the UI. 

1. Run the agentgateway from which you want to remove a route. 
   ```sh
   agentgateway -f config.yaml
   ```

2. [Open the agentgateway route UI](http://localhost:15000/ui/routes/) and find the route that you want to remove. 
   {{< reuse-image src="img/agentgateway-ui-routes.png" >}}

3. Click the trash icon to remove the route. 

{{% /tab %}}
{{% tab %}}

Update the configuration file to remove the route.

1. Remove the route from your configuration file.
2. Apply the updated configuration file to your agentgateway.

   ```sh
   agentgateway -f config.yaml
   ```

{{% /tab %}}
{{< /tabs >}}

## Next steps

After you create routes, you might want to apply policies to them.

{{< cards >}}
  {{< card link="/docs/traffic-management/matching" title="Request matching" >}}
  {{< card link="/docs/traffic-management/" title="Traffic management" >}}
  {{< card link="/docs/resiliency/" title="Resiliency" >}}
  {{< card link="/docs/security/" title="Security" >}}
{{< /cards >}}
