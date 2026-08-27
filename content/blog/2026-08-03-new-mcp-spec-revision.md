---
title: "Agentgateway out the gate with support for the 2026-07-28 MCP specification with release of version 1.4"
category: "Release"
publishDate: 2026-08-03
author: "Eitan Suez"
description: "Discusses the new revision of the MCP specification, and agentgateway version 1.4's explicit support for it."
toc: false
---

The [latest revision of the MCP specification](https://modelcontextprotocol.io/specification/2026-07-28) \-- `2026-07-28` \-- is finally out.

There are plenty of resources out there talking about the new revision. One that I came across a couple of weeks ago is [An MCP Tool Call Deconstructed](https://torresmateo.com/mcp-tool-call-deconstructed/), which I'm sure you'll enjoy.

One thing is undeniable: the people involved in bringing about this new revision have not been idle. It feels like solid progress on multiple fronts as we continue to evolve and refine the way we build agentic solutions.

## The new spec, briefly

In a nutshell, the protocol is no longer stateful. This change does away with a litany of issues relating to handling state. With the new specification, we no longer worry about directing clients to sticky server instances to maintain state.

We no longer see MCP session IDs accompanying requests and responses, and clients no longer open with an `initialize` method call.

There's a new `server/discover` endpoint for exchanging MCP protocol version and capabilities information. "Dual era" servers gracefully handle communicating with both legacy and new-era clients.

Clients can now cache the tools, prompt, and resource lists, thanks to "time to live" caching hints that servers can now provide in their responses.

Another interesting addition is the repetition of the MCP metadata (protocol version, method, and name) in request headers, to make it easier for intermediaries in charge of routing requests, who otherwise need to parse request bodies to get at that information.

The specification now formalizes [extensions](https://modelcontextprotocol.io/extensions/overview), a way to separate core capabilities from perhaps optional additional features that focus on a specific capability. The new revision formalizes three MCP extensions: MCP Apps, Tasks, and Enterprise Managed Authorization.

With respect to security, there existed lingering issues with [client registration](https://modelcontextprotocol.io/specification/2026-07-28/basic/authorization/client-registration).  Dynamic Client Registration is now deprecated and in its place Client ID Metadata Documents (CIMD) is recommended. To address problems in enterprises who need to maintain security and access to a multiplicity of MCP servers that reside outside the enterprise's direct control, is the "Enterprise Managed Authorization" extension, which leverages new OAuth drafts and specifications that address scenarios spanning multiple identity domains.

Version 2 of the [MCP Inspector](https://modelcontextprotocol.io/docs/2026-07-28/tools/inspector) is out, and with it come some nice improvements. Inspector supports configuring multiple servers, and pre-configuring them with the `--catalog` flag.

I particularly like how easily one can get at the details of a client-server communication, request and response bodies, connection information, and auth tokens, which can now be decoded in-app.

The SDKs cleanly manage protocol version negotiation:  a client will detect if a `server/discover` request succeeds to determine whether the new protocol is supported.

## The role of gateways in agentic systems

Gateways are necessary infrastructure components that provide observability, auditing, security, and control over the communication flow in an agentic system.

Gateways mediate communications between agents, LLMs, and MCP servers. They help collect telemetry that supports logging, tracing, and otherwise auditing the interactions between these actors. Gateways serve as policy enforcement points, granting or denying access to backends, they rate-limit access to LLMs and otherwise help us mitigate costs, and they control the routing of requests to selected models. With respect to MCP, gateways provide authorization and control over who can access specified tools and resources. Gateways can federate multiple tools servers, and can implement MCP Authentication so that those concerns are not coupled to the backend MCP server.

As one of the building blocks of agentic solutions, it's important for gateways to natively understand agentic protocols including MCP, and to understand and support the relevant revisions of the protocol. MCP-native gateways act as the MCP server to agents, and on the other side of that connection, they act as MCP clients to backend MCP servers.

## Agentgateway version 1.4

[Agentgateway](https://agentgateway.dev/) v1.4 was released on July 27, one day before the release of the `2026-07-28` revision of the MCP spec. One of version 1.4's biggest themes is support for the new revision of the specification. Version 1.4.1 has already been released, only 2 days later, providing increased compatibility with the new revision.

Agentgateway's repository comes with a long list of [examples](https://github.com/agentgateway/agentgateway/tree/main/examples) demonstrating the features and capabilities of agentgateway.

## Try out the examples

Start with the simple [MCP Basic example](https://github.com/agentgateway/agentgateway/tree/main/examples/mcp-basic) to proxy an MCP server that adheres to the new revision of the protocol, and test the communication between an MCP client and agentgateway.

The example uses the canonical ["everything"](https://github.com/modelcontextprotocol/servers/tree/main/src/everything) MCP server as the backend.
As of the time of this writing, that particular MCP server has not yet been ported to the new revision of the spec.
If necessary, stand up a simple MCP server of your own; see the [Python SDK docs](https://py.sdk.modelcontextprotocol.io/v2/) for an example.

Another more interesting scenario is a gateway that multiplexes or federates multiple MCP servers. The [example](https://github.com/agentgateway/agentgateway/tree/main/examples/mcp-multiplex) can be interesting to test using a mix of legacy and "new era" MCP servers.

MCP Apps have been with us for a few months already, but with the release of the `2026-07-28` revision, the MCP Apps extension is explicitly graduated. Try out the [MCP Apps example](https://github.com/agentgateway/agentgateway/tree/main/examples/mcp-apps) to see how the feature works with a proxy sitting in between MCP client and server. The README has you use the [Basic Host example](https://github.com/modelcontextprotocol/ext-apps/tree/main/examples/basic-host) from the [ext-apps repository](https://github.com/modelcontextprotocol/ext-apps). But you can also try it out with the new "v2" MCP inspector, which also supports MCP Apps. Launch the inspector, connect to the server, select the "Apps" tab and open the app.

If you're curious to see how agentgateway helps visualize traces for MCP calls, check out the [mcp-telemetry example](https://github.com/agentgateway/agentgateway/tree/main/examples/mcp-telemetry).

With respect to security, you can leverage agentgateway to implement MCP authentication and authorization as a cross-cutting concern. The repository provides examples for each [MCP authentication](https://github.com/agentgateway/agentgateway/tree/main/examples/mcp-authentication) and [MCP authorization](https://github.com/agentgateway/agentgateway/tree/main/examples/mcp-authorization).

Another long awaited addition to the MCP specification is the [Enterprise Managed Authorization](https://modelcontextprotocol.io/extensions/auth/enterprise-managed-authorization) extension. This extension addresses real issues for enterprise users accessing systems that span identity domains. It incorporates the use of the ID-JAG OAuth specification also known as "Cross App Access" to deliver a "single sign-on" experience in that context.

Agentgateway provides three distinct [examples of Cross App Access](https://github.com/agentgateway/agentgateway/tree/main/examples/traffic-cross-app-access) that you can try out today.

Those are just some of the many examples that come out of the box with the agentgateway repository.

## Summary

The pace of advances in the agentic ecosystem continues.  We are moving as a community towards adoption of the new MCP specification. Agentgateway is there to support you in that effort to help you build solutions that are observable, secure, cost effective, and that keep you in control.

Join us August 4 for a hands-on workshop on this very subject:  [The Updated MCP Spec: the Good, the Bad, and the Ugly](https://www.solo.io/resources/workshop/the-new-mcp-spec-the-good-the-bad-the-ugly). Bring your questions and be ready to try out some new labs. 