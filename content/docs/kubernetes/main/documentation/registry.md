---
title: AI artifact registry
weight: 50
description: Discover, govern, and route to agents, MCP servers, prompts, and skills that are cataloged in an AI artifact registry.
test: skip
---

Agentgateway connects to an AI artifact registry that catalogs and governs the agents, Model Context Protocol (MCP) servers, prompts, and skills that requests route to. Instead of hardcoding backend addresses or tracking artifacts across Slack threads and spreadsheets, you point agentgateway at the registry and let the registry resolve which artifacts exist, which versions are approved, and where they run.

## About the AI artifact registry

The registry is built on the open source [agentregistry project](https://aregistry.ai). Agents, MCP servers, prompts, and skills are published to the registry with a name, version, and metadata, so that agentgateway and other consumers can discover and reuse them instead of relying on ad-hoc sharing. Every artifact carries an approval status, so agentgateway can route only to artifacts that passed review.

The following screenshot shows the registry dashboard, where published artifacts, their versions, and their approval status are visible in one place.

![Solo Enterprise for agentregistry dashboard, showing published agents, MCP servers, prompts, and skills with their version and approval status](https://docs.solo.io/agentregistry/img/agentregistry/ar-dashboard.svg)

## Use cases

- **Discover backends to route to.** Find approved MCP servers and agents to connect through agentgateway, instead of hardcoding addresses that only a few people know about.
- **Govern what agentgateway can reach.** Limit agentgateway to artifacts that passed review, so unapproved or unmaintained backends never receive production traffic.
- **Roll out new versions.** Move agentgateway traffic to a new version of an MCP server or agent as the registry approves it, without hand-editing gateway configuration for every backend.

## Benefits

- **One source of truth.** Replace tribal knowledge and informal sharing with a single catalog of the MCP servers, agents, prompts, and skills that agentgateway can route to.
- **Composable agents.** Build agents by combining published MCP servers, prompts, and skills instead of writing a new integration for each one.
- **Semantic discovery.** Find the artifact you need by describing it, instead of knowing its exact name, through agentregistry's built-in search.

## Enable the AI artifact registry

Agentgateway routes to artifacts that are published to the open source [agentregistry project](https://aregistry.ai). For centralized governance, approval workflows, and multi-cloud deployment across an organization, install [Solo Enterprise for agentregistry](https://www.solo.io/products/agentregistry) instead. For installation steps, see the [Solo Enterprise for agentregistry documentation](https://docs.solo.io/agentregistry/).