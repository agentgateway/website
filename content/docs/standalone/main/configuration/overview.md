---
title: Overview
weight: 10
description: Understand agentgateway's top-level configuration sections and how to write, update, and run a configuration file.
next: /configuration/gateways
---

Manage agentgateway through a configuration file. Supported file formats are JSON and YAML.

## Configuration sections {#sections}

Agentgateway configuration has a few top level sections:

* `config` configures top level settings. These options are the only ones that are not dynamically configured.
* `gateways` provides the entry point for traffic, defining the ports and listeners that routes and features attach to. For more information, see [Gateways]({{< link-hextra path="/configuration/gateways/" >}}).
* `routes` and `tcpRoutes` define how traffic that reaches a gateway is matched and forwarded to backends.
* `llm` provides a simplified, model-centric configuration for routing requests to LLM providers. For more information, see [LLM configuration modes]({{< link-hextra path="/llm/configuration-modes/" >}}).
* `mcp` provides a simplified configuration for connecting to MCP servers without requiring individual routes and backends.
* `ui` exposes the agentgateway UI on a gateway instead of only on the admin interface.
* `binds` is the deprecated predecessor to `gateways`, which nests listeners and routes under each port. Use `gateways` and `routes` instead. For help converting, see [Migrate from binds]({{< link-hextra path="/configuration/gateways/#migrate-from-binds" >}}).
* `services` and `workloads` can be used for very advanced cases where backends need to be represented as complex objects rather than simple URLs. However, it is recommended to [use agentgateway on Kubernetes](https://agentgateway.dev/docs/kubernetes/) for these purposes.


### Example configuration file {#example-file}

```yaml
{{% github url="https://agentgateway.dev/examples/mcp-basic/config.yaml" %}}
```

## Update configuration {#add}

To update configuration, you can write to the configuration file or use the agentgateway UI.

* **Write to the file**: Most changes that you make to the file are automatically picked up by agentgateway, with the exception of the top-level `config` section.
* **UI**: The agentgateway UI overwrites the contents of the configuration file. Note that any comments that you add to the file are wiped out! You can open the agentgateway UI on port 15000.

## Run your configuration {#run}

To run agentgateway, install the agentgateway binary and pass the file with the `-f` option, such as the following example command.

```shell
agentgateway -f config.yaml
```

## Configuration overview

Agentgateway's core configuration is made up of gateways, {{< gloss "Listener" >}}listeners{{< /gloss >}}, {{< gloss "Route" >}}routes{{< /gloss >}}, and {{< gloss "Backend" >}}backends{{< /gloss >}}.

* **Gateways** are the main entry point for incoming traffic. Each gateway is a named port. For a simple setup, you might have just a single gateway. More complex setups might have multiple gateways to serve different ports.
* **Listeners** subdivide a gateway when one port must serve multiple domains with different TLS certificates.
* **Routes** define how incoming traffic is matched and forwarded to backends. Routes attach to gateways by name.
* **Backends** are the targets that receive traffic from agentgateway. Backends can be simple URLs or more complex backends, like an MCP server or {{< gloss "Provider" >}}LLM provider{{< /gloss >}}.

A minimal configuration that accepts HTTP traffic on port 3000 and forwards it to a backend running on `localhost:8000` looks like the following example.

```yaml
# yaml-language-server: $schema=https://agentgateway.dev/schema/config
gateways:
  default:
    port: 3000
routes:
- backends:
  - host: localhost:8000
```
