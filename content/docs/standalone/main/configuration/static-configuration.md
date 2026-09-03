---
title: Static configuration
weight: 10
description: Configure static settings that are applied at startup time.
---

Most agentgateway configurations dynamically update as you make changes to the gateways, routes, policies, backends, and so on. 

However, a few configurations are statically configured at startup. These static configurations are under the `config` section.

For example, use `config.customFunctions` to define reusable CEL expressions.
Agentgateway registers these functions at startup, so you must restart the
process after changing them. For syntax and examples, see
[Custom CEL functions]({{< link-hextra path="/reference/cel/custom-functions/" >}}).

## Static configuration file schema

The following table shows the `config` file schema for static configurations at startup. For the full agentgateway schema of dynamic and static configuration, see the [reference docs]({{< link-hextra path="/reference/configuration/schema/" >}}).

{{% github-table url="https://raw.githubusercontent.com/agentgateway/agentgateway/refs/heads/main/schema/config.md" 
   section="Configuration File Schema"
   exclude="^\\|.(gateways|routes|tcpRoutes|ui|binds|frontendPolicies|policies|services|workloads|backends|llm|mcp|routeGroups)"
   timeout="120s"
%}}
