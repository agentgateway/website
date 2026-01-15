---
title: Static configuration
weight: 10
description:
---

Most agentgateway configurations dynamically update as you make changes to the binds, policies, backends, and so on. 

However, a few configurations are staticly configured at startup. These static configurations are under the `config` section.

## Static configuration file schema

The following table shows the `config` file schema for static configurations at startup. For the full agentgateway schema of dynamic and static configuration, see the [reference docs](/docs/reference/configuration).

{{% github-table url="https://raw.githubusercontent.com/agentgateway/agentgateway/refs/heads/main/schema/config.md" 
   section="Configuration File Schema"
   exclude="^\\|.(binds|frontendPolicies|policies|services|workloads|backends)"
%}}
