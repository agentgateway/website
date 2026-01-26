---
title: About
weight: 10 
description:
next: /docs/mcp/connect
---

Learn more about MCP and common challenges when adopting MCP in enterprise environments. 

## About MCP

[Model Context Protocol (MCP)](https://modelcontextprotocol.io/introduction) is an open protocol that standardizes how Large Language Model (LLM) applications connect to various external data sources and tools. Without MCP, you need to implement custom integrations for each tool that your LLM application needs to access. However, this approach is hard to maintain and can cause issues when you want to scale your environment. With MCP, you can significantly speed up, simplify, and standardize these types of integrations.

An MCP server exposes external data sources and tools so that LLM applications can access them. Typically, you want to deploy these servers remotely and have authorization mechanisms in place so that LLM applications can safely access the data.

With agentgateway, you can connect to one or multiple MCP servers in any environment. The agentgateway proxies requests to the MCP tool that is exposed on the server. You can also use the agentgateway to federate tools from multiple MCP servers. For more information, see the [MCP multiplexing]({{< link-hextra path="/mcp/connect/multiplex/" >}}) guide. 

## MCP vs. A2A

MCP and [Agent-to-Agent (A2A)](https://github.com/a2aproject/A2A) are the leading protocols for enabling communication between agents and tools. MCP helps to retrieve and exchange context with Large Language Models (LLMs) and connect LLMs to tools. On the other hand, A2A solves for long-running tasks and state management across multiple agents. MCP and A2A are both JSON-RPC protocols that define the structure of how an agent describes what it wants to do, how it calls tools, and how it hands off tasks to other agents.

## Challenges with MCP and A2A

{{< reuse "agw-docs/snippets/about-mcp-challenges.md" >}}