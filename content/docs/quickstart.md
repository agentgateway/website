---
title: Get started
weight: 10
description: Get started with agentgateway. 
---

Get started with agentgateway, an open source, highly available, and highly scalable data plane that brings AI connectivity for agents and tools. To learn more about agentgateway, see the [About](/docs/about) section. 

## About this guide

In this guide, you learn how to use the agentgateway to proxy requests to an open source MCP test server that exposes multiple MCP test tools. 

You complete the following tasks: 
* Install the agentgateway binary on your local machine. 
* Create an agentgateway configuration that proxies requests to multiple tools that are exposed on an open source MCP test server, `server-everything`. 
* Explore the agentgateway UI.
* Test access to the `everything_echo` MCP tool. 

{{< reuse-image src="img/quickstart.svg" width="700px" >}}

## Step 1: Install the binary {#binary}

1. Download the agentgateway binary and install it. 
   ```sh
   curl https://raw.githubusercontent.com/agentgateway/agentgateway/refs/heads/main/common/scripts/get-agentproxy | sh
   ```
   
   Example output: 
   ```
     % Total    % Received % Xferd  Average Speed   Time    Time     Time  Current
                                 Dload  Upload   Total   Spent    Left  Speed
   100  8878  100  8878    0     0  68998      0 --:--:-- --:--:-- --:--:-- 69359

   Downloading https://github.com/agentgateway/agentgateway/releases/download/v0.4.16/agentgateway-darwin-arm64
   Verifying checksum... Done.
   Preparing to install agentgateway into /usr/local/bin
   Password:
   agentgateway installed into /usr/local/bin/agentgateway
   ```

2. Verify that the `agentgateway` binary is installed. 
   ```sh
   agentgateway --version
   ```

   Example output with the latest version, {{< reuse "docs/versions/n-patch.md" >}}:
   ```
   agentgateway-app version.BuildInfo{RustVersion:"1.88.0", BuildProfile:"release", BuildStatus:"Modified", GitTag:"v{{< reuse "docs/versions/n-patch.md" >}}", Version:"2c7ba0d4ed47fcafa97fa411fdbf1a8ca40cf6a9-dirty", GitRevision:"2c7ba0d4ed47fcafa97fa411fdbf1a8ca40cf6a9-dirty"}
   ```
   
## Step 2: Create a basic configuration {#basic-config}

In this example, you use a basic configuration file to configure the agentgateway, but you can also use the agentgateway UI to configure these components. For examples, see the [Listeners](/docs/listeners) and [Backends](/docs/backends) guides.

1. Download a basic configuration file for your agentgateway. 
   
   ```yaml
   curl -L https://raw.githubusercontent.com/agentgateway/agentgateway/refs/heads/main/examples/basic/config.yaml -o config.yaml
   ```

2. Review the configuration file. 

   ```
   cat config.yaml
   ```

   ```yaml
   {{< github url="https://raw.githubusercontent.com/agentgateway/agentgateway/refs/heads/main/examples/basic/config.yaml" >}}
   ```

   {{< reuse "docs/snippets/review-table.md" >}}

   {{< reuse "docs/snippets/example-basic-mcp.md" >}}

3. Run the agentgateway. 
   ```sh
   agentgateway -f config.yaml
   ```
   
   Example output: 
   ```
   2025-04-16T20:19:36.449164Z  INFO agentgateway: Reading config from file: basic.yaml
   2025-04-16T20:19:36.449580Z  INFO insert_target: agentgateway::xds: inserted target: everything
   2025-04-16T20:19:36.449595Z  INFO agentgateway::r#static: local config initialized num_mcp_targets=1 num_a2a_targets=0
   2025-04-16T20:19:36.449874Z  INFO agentgateway::inbound: serving sse on [::]:3000
   ```

## Step 3: Explore the UI {#explore-ui}

The agentgateway comes with a built-in UI that you can use to connect to your MCP target to view and access the tools that are exposed on the MCP server. You can also use the UI to review and update your listener and target configuration in-flight. Configuration updates are available immediately and do not require a restart of the agentgateway.  

1. Open the built-in [agentgateway UI](http://localhost:15000).
   {{< reuse-image src="img/agentgateway-ui-home.png" >}}
   
2. Go to the [**Listener** overview](http://localhost:15000/ui/listeners/) and review your listener configuration. To learn how to create more or delete existing listeners with the UI, see the [Listeners](/docs/listeners) docs. 

   {{< reuse-image src="img/agentgateway-ui-listener-basic.png" >}}

3. Go to the [**Routes** overview](http://localhost:15000/ui/routes/) and review your route and policy configuration. To learn how to create more or delete existing routes with the UI, see the [Routes](/docs/listeners) docs. 
   {{< reuse-image src="img/agentgateway-ui-routes.png" >}}

4. Go to the [**Backends** overview](http://localhost:15000/ui/targets/) and review your target configuration. To learn how to create more or delete existing targets with the UI, see the [Backends](/docs/backends) docs. 
   {{< reuse-image src="img/agentgateway-ui-backends.png" >}}

5. Go to the [**Policies** overview](http://localhost:15000/ui/policies/) and review your route and policy configuration. To learn more about policies, see the [About policies](/docs/about#policies) docs. 
   {{< reuse-image src="img/agentgateway-ui-policies.png" >}}

6. Connect to the MCP test server with the agentgateway UI playground. 
   
   1. Go to the agentgateway UI [**Playground**](http://localhost:15000/ui/playground/).
      
      {{< reuse-image src="img/agentgateway-ui-playground.png" >}}

   2. In the **Testing** card, review your **Connection** details and click **Connect**. The agentgateway UI connects to the target that you configured and retrieves the tools that are exposed on the target. 
   
   3. Verify that you see a list of **Available Tools**. 
   
      {{< reuse-image src="img/ui-playground-tools.png" >}}

7. Verify access to a tool. 
   1. From the **Available Tools** list, select the `echo` tool. 
   2. In the **message** field, enter any string, such as `This is my first agentgateway setup.`, and click **Run Tool**. 
   3. Verify that you see your message echoed in the **Response** card. 
   
      {{< reuse-image src="img/ui-playground-tool-echo.png" >}}

## Next

With your agentgateway up and running, you can now explore the following tasks: 

* [Configure other backends](/docs/backends), such as multiple MCP servers, an A2A agent, or an OpenAPI server. 
* [Secure your agentgateway setup](/docs/security), such as by setting up a TLS listener, JWT authentication, and RBAC policies to control access to tools and agents. 
* [Explore metrics and traces](/docs/observability) that the agentgateway emits so that you can monitor the traffic that goes through your agentgateway. 

