---
title: Get started
weight: 10
description: Deploy a basic agentproxy on your machine. 
---

Get started with agentproxy, an open source, highly available, and highly scalable data plane that brings AI connectivity for agents and tools. To learn more about agentproxy, see the [About](/docs/about) section. 

## About this guide

In this guide, you learn how to use the agentproxy to proxy requests to an open source MCP test server that exposes multiple MCP test tools. 

{{< reuse-image src="img/quickstart.svg" width="500px" >}}

You complete the following tasks: 
* Install the agentproxy binary on your local machine. 
* Create an agentproxy configuration that proxies requests to multiple tools that are exposed on an open source MCP test server, `server-everything`. 
* Test access to the `everything_echo` MCP tool. 
* Explore the agentproxy UI. 


## Step 1: Install the binary


1. Download the agentproxy binary and install it. 
   ```sh
   curl https://raw.githubusercontent.com/agentproxy-dev/agentproxy/refs/heads/main/common/scripts/get-agentproxy | bash
   ```
   
   Example output: 
   ```
     % Total    % Received % Xferd  Average Speed   Time    Time     Time  Current
                                 Dload  Upload   Total   Spent    Left  Speed
   100  8878  100  8878    0     0  68998      0 --:--:-- --:--:-- --:--:-- 69359

   Usage: agentproxy [OPTIONS]

   For more information, try '--help'.
   agentproxy v0.4.10 is available. Changing from version .
   Downloading https://github.com/agentproxy-dev/agentproxy/releases/download/v0.4.10/agentproxy-darwin-arm64
   Verifying checksum... Done.
   Preparing to install agentproxy into /usr/local/bin
   Password:
   agentproxy installed into /usr/local/bin/agentproxy
   ```

2. Verify that agentproxy is installed. 
   ```sh
   agentproxy --version
   ```
   
## Step 2: Set up an agentproxy

1. Create a listener and target configuration for your agentproxy. In this example, you use a configuration file to configure the agentproxy, but you can also use the agentproxy UI or admin API to configure these components. For examples, see the [Listeners](/docs/listeners) and [Targets](/docs/targets) guides. 
   
   The agentproxy in this example is configured as follows: 
   * **Listener**: An SSE listener is configured and exposed on port 3000. 
   * **Target**: The agentproxy targets a sample, open source MCP test server, `server-everything`. The server runs the entire MCP stack in a single process and can be used to test, develop, or demo MCP environments. 
   
     To run the server, you use the standard input/output (`stdio`) capability of the agentproxy, which allows you to pass in the command and command arguments that you want to use. In this example, the `npx` command is used. The `npx` command utility lets you to run a Node.js package (`@modelcontextprotocol/server-everything`) without installing it. If you do not have `npx` on your machine, follow the [instructions to install Node.js](https://nodejs.org/en/download).
   ```sh
   cat <<EOF > config.json
   {{< github url="https://raw.githubusercontent.com/agentproxy-dev/agentproxy/refs/heads/main/examples/basic/config.json" >}}
   EOF
   ```

2. Run the agentproxy. 
   ```sh
   agentproxy -f config.json
   ```
   
   Example output: 
   ```
   2025-04-16T20:19:36.449164Z  INFO agentproxy: Reading config from file: basic.json
   2025-04-16T20:19:36.449580Z  INFO insert_target: agentproxy::xds: inserted target: everything
   2025-04-16T20:19:36.449595Z  INFO agentproxy::r#static: local config initialized num_mcp_targets=1 num_a2a_targets=0
   2025-04-16T20:19:36.449874Z  INFO agentproxy::inbound: serving sse on [::]:3000
   ```

## Step 3: Access an MCP tool

1. Run the MCP inspector, a debugging and visualization tool for the Model Context Protocol.
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

3. Connect to the agentproxy. 
   1. Switch the **Transport Type** to `SSE`.
   2. Change the URL to `http://localhost:3000/sse`, which represents the address that the agentproxy is exposed on. 
   3. Click **Connect** to connect to the agentproxy. 

4. Access an MCP tool. 
   1. In the MCP inspector, go to **Tools**.
   2. Click **List Tools** to show the tools that the agentproxy has access to from the `server-everything` target that you configured earlier.
   3. Select the **everything_echo** tool. 
   4. In the **message** field, enter any string, such as `This is a sample agentproxy setup.`. 
   5. Click **Run Tool** to execute the tool. 
   6. Verify that your string is echoed back.
   
   {{< reuse-image src="img/agentproxy-basic.png" >}}


## Step 4: Explore the UI

The agentproxy comes with a built-in UI that you can use to review and update your agentproxy configuration in-flight. Configuration updates are available immediately and do not require a restart of the agentproxy.  

1. Open the built-in [agentproxy UI](http://localhost:19000). 

2. Verify that you see the listener and the MCP target that you set up earlier. 
   {{< reuse-image src="img/agentproxy-ui-home.png" >}}
   
3. Go to the [**Listener** overview](http://localhost:19000/ui/listeners/) and review your listener configuration. 

   {{< reuse-image src="img/agentproxy-ui-listener-basic.png" >}}
   
4. Go to the [**Targets** overview](http://localhost:19000/ui/targets/) and review your target configuration. 
   {{< reuse-image src="img/agentproxy-ui-targets.png" >}}

## Next

With you agentproxy up and running, you can now explore the following tasks: 

* [Configure other targets](/docs/targets), such as multiple MCP servers, an A2A agent, or an OpenAPI spec. 
* [Secure your agentproxy setup](/docs/security), such as by setting up a TLS listener, JWT authentication, and RBAC policies to control access to tools and agents. 
* [Explore metrics and traces](/docs/observability) that the agentproxy emits so that you can monitor the traffic that goes through your agentproxy. 

