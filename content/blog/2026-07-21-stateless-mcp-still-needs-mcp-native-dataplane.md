---
title: "MCP goes stateless with headers. Do you need an MCP-native data plane?"
category: "Deep Dive"
publishDate: 2026-07-21
author: "Christian Posta"
description: "Stateless, header-forwarding MCP makes servers easier to scale out but introduce attack vectors"
toc: false
---

{{< reuse-image src="img/blog/mcp-update-july/blog-image.png" width="700px" >}}

The next revision of the Model Context Protocol (MCP) is _supposed_ to make implementation infrastructure (ie, gateways, routers, etc) easier to reuse/implement. The draft (`2026-07-28`) is intended to **make every request self-contained and independently routable, and clean up anything that got in the way of that.** Sessions, the `initialize` handshake, server-to-client callbacks, etc are all gone or deprecated.

If you expose MCP servers from a MCP/agentgateway, this is a consequential set of changes. And it's already prompting a question I am hearing from platform teams: *if MCP is now stateless and its routing fields live in HTTP headers, can't I just use a plain L7 load balancer or API gateway? Do I need an MCP native data plane like agentgateway?*

The premise is misunderstood. The short answer is **no!**  and the new spec actually makes a naive header-only proxy **more** dangerous, not less. This post walks through what changed, why a traditional proxy breaks under it, and what an MCP-native data plane like [agentgateway](https://agentgateway.dev) does instead. We'll even give you the most basic, runnable demo to prove it out.

## What actually changed

Three "mega-SEPs" reshape everything else, and most of the rest of the draft falls out of them.

- **Stateless MCP ([SEP-2575](https://modelcontextprotocol.io/specification/draft/changelog)).** The `initialize` / `notifications/initialized` handshake is removed. Every request now carries its own `io.modelcontextprotocol/protocolVersion`, `clientInfo`, and `clientCapabilities` in `_meta`, and a new mandatory `server/discover` RPC handles up-front capability and version negotiation. `ping`, `logging/setLevel`, and SSE resumability (`Last-Event-ID`) are gone.
- **Sessionless MCP (SEP-2567).** The `Mcp-Session-Id` header and all session-lifecycle language are removed. List endpoints (`tools/list`, etc.) no longer vary per connection, which makes them cacheable. Cross-call state moves to explicit, server-minted handles passed as ordinary tool arguments.
- **HTTP transport standardization (SEP-2243).** Routing fields are mirrored out of the JSON-RPC body into HTTP headers: `Mcp-Method` mirrors `method`, `Mcp-Name` mirrors `params.name`/`params.uri`, and servers can promote individual tool arguments into `Mcp-Param-*` headers via an `x-mcp-header` annotation in the tool schema.

Rounding it out: server-initiated requests (sampling, elicitation, roots callbacks) are replaced by the **Multi Round-Trip Request** pattern (SEP-2322); Tasks becomes an official extension (SEP-2663); and Roots, Sampling, and Logging are deprecated (SEP-2577).

The current *finalized* version (as of writing, one week before 7-28) is still `2025-11-25`. agentgateway already implements the draft line as protocol version `2026-07-28`, running the old and new protocols side by side, so we can talk about this concretely rather than hypothetically.

## Wait!! "Now any load balancer can route MCP?"

Historically, routing information was "buried deep within the JSON-RPC payload," forcing intermediaries to "terminate TLS and perform deep packet inspection to route traffic." Lifting `Mcp-Method` and `Mcp-Name` into headers fixes that. And it genuinely does make coarse routing and rate-limiting easy for standard infrastructure.

And that's exactly where it should stop. The mistake is extrapolating from *routing* to *policy and trust*. Once you decide the header is the source of truth, four things break: security, authorization UX, federation, and identity. Let's dig into them.

## Security: the header can lie to you

Headers and body are two copies of the same story, and nothing forces them to tell it the same way. Both are sent by the client. SEP-2243 anticipates exactly this and mandates that *"any server processing the message body MUST validate that the HTTP header values exactly match the corresponding values in the JSON-RPC body."*

But a header-only proxy, by definition, never opens the body. Picture this: a support-desk agent is allowed to reach one MCP server through the gateway, and the platform team has locked it down to a single safe tool (`echo`) with a header allowlist. Reasonable enough. Except the same server also exposes `printEnv`. An attacker (or a prompt-injected agent) sends:

```http
POST /mcp HTTP/1.1
Mcp-Method: tools/call
Mcp-Name: echo

{"jsonrpc":"2.0","id":2,"method":"tools/call","params":{"name":"printEnv","arguments":{}}}
```

The proxy sees `Mcp-Name: echo`, decides "echo is safe," and forwards. The header said `echo`. The body ran `printEnv` and dumped its environment variables, secrets and all. This is simple header/body mismatching and it's been the root cause of a long line of CVEs in other protocols. Relying on the server SDK to catch it is not a great plan: it's exactly the "someone else will validate it" assumption that these bugs live in.

An MCP-native gateway parses the body and validates the headers against it. Send that spoof through agentgateway and it never reaches the backend:

```console
$ curl -sS http://localhost:3000/mcp \
    -H 'Content-Type: application/json' \
    -H 'Accept: application/json, text/event-stream' \
    -H 'Mcp-Method: tools/call' -H 'Mcp-Name: echo' \
    -d '{"jsonrpc":"2.0","id":2,"method":"tools/call","params":{"name":"printEnv","arguments":{}}}'

{"jsonrpc":"2.0","id":2,"error":{"code":-32020,"message":"Mcp-Name header/body mismatch"}}
```

(The full walkthrough of honest calls, method spoof, and policy denial is in [Try it yourself](#try-it-yourself) at the end.)

The spoofed request is rejected with a JSON-RPC `HeaderMismatch` error (code `-32020`, the exact allocation SEP-2243 reserves) before it ever reaches a backend. The validation runs on every Streamable HTTP POST, ahead of any routing or session logic, and the check fires whenever a header is present and disagrees with the body, regardless of which protocol version the client negotiated.

## Authorization and UX: filtering and graceful errors

Suppose you push authorization down to the header anyway. Two things go wrong immediately.

**You can't filter the tool list.** `tools/list` is a body-level response; a header-only proxy can't rewrite it. So a user authorized for 2 of 100 tools sees all 100, and the model repeatedly tries to call tools it can't use. That's a miserable agent experience, and it leaks the shape of your whole tool surface to every caller.

agentgateway evaluates policy against the real request and filters the list. Policies are CEL expressions that can reference the tool name, the **call arguments**, and JWT claims, not just the header-exposed name (`examples/mcp-authorization`):

```yaml
mcp:
  policies:
    jwtAuth:
      issuer: agentgateway.dev
      audiences: [test.agentgateway.dev]
      jwks: { file: ./manifests/jwt/pub-key }
    mcpAuthorization:
      rules:
      - 'mcp.tool.name == "echo"'                              # anyone may echo
      - 'jwt.sub == "test-user" && mcp.tool.name == "get-sum"' # only test-user
      - 'mcp.tool.name == "get-env" && jwt.nested.key == "value"'
```

Tools that fail policy are dropped from `tools/list`, so the model only ever sees what the caller can actually use. This is fundamentally a body-and-identity operation; there is no header that carries it.

**You return the wrong kind of error.** In MCP, application-level failures are supposed to come back as JSON-RPC errors that the agent reads and routes around ("that tool isn't available, I'll try another path"). A naive proxy that answers a denied call with a bare HTTP `403` instead signals a transport- or auth-level failure, and clients treat that very differently, often tearing down the connection rather than gracefully continuing. agentgateway returns a structured JSON-RPC error the agent can act on, and it deliberately *hides* the tool's existence rather than confirming it was denied:

```json
{"jsonrpc":"2.0","id":4,"error":{"code":-32602,"message":"Unknown tool: printEnv"}}
```

That distinction matters more than it looks. "Access denied" confirms the tool is there and worth attacking; "unknown tool" hands a prober nothing to work with. The higher-level modes people are building on MCP (code mode, search mode, and similar) all depend on this body-level intelligence. None of it is reachable from headers.

## Federation, and "free" statelessness

A big feature that nearly all of our users use: "Virtual MCP" where a single MCP endpoint exposed on the gateway exposes multiple backend MCP servers. Here is where header-only routing goes from limiting to impossible. **Multiplexing** (via the Virtual MCP concept) requires rewriting the body: namespacing tool names so they don't collide, demultiplexing a `tools/call` back to the server that owns the tool, merging `tools/list` responses, and reconciling protocol versions across backends. agentgateway does all of this (`examples/mcp-multiplex`): tools are namespaced as `target_tool`, list operations fan out and merge, and calls are routed to the single owning backend. A header-only proxy has nowhere to put any of that logic.

The statelessness change does have a nice payoff worth calling. Under the old protocol, sessions pinned a client to a specific server instance; a proxy had to track and map session IDs to preserve that, and until proxies solved it you were effectively limited to a single replica per MCP server. agentgateway solved session mapping, but the draft makes the whole problem *disappear* for everyone: with no `Mcp-Session-Id` and self-contained requests, any request can go to any replica. Scaling an MCP backend horizontally becomes ordinary load balancing. That's a real win, and credit goes to the MCP maintainers for designing the session problem out of existence rather than papering over it. It also frees the gateway to focus on trust, policy, and federation rather than session bookkeeping.

## Identity: where the data plane carries the load

Most of the draft's authorization work is about clients and servers, and much of it doesn't strictly require an MCP-native proxy. But it leans heavily on there being a capable identity layer in the path, and that's exactly the territory agentgateway has been building out. It's already on `main`, with tests and examples.

- **OAuth resource server.** agentgateway serves the `.well-known/oauth-protected-resource` and `oauth-authorization-server` metadata, issues `WWW-Authenticate` challenges, and validates JWTs across multiple issuers, with provider-specific handling for Auth0, Okta, Keycloak, and Descope.
- **Token exchange (RFC 8693).** Incoming user tokens are exchanged for downstream-scoped tokens, with actor/subject token support and caching (`examples/traffic-token-exchange`).
- **Identity assertion / ID-JAG.** A two-leg chained exchange (token-exchange → ID-JAG assertion → `jwt-bearer` → access token) for cross-application access, so an MCP call can carry a properly scoped, audience-bound identity to the backend (`examples/traffic-cross-app-access`).

This connects directly to the draft's smaller auth items, including issuer (`iss`) validation for multi-AS mix-up protection (SEP-2468) and the multi-authorization-server migration guidance (SEP-2352), where per-issuer JWT validation is already in place.

## The Key Takeaway

The draft's thesis of self-contained, independently routable requests is the right direction, and it does make MCP easier to *move* through standard infrastructure. But moving bytes is not the same as enforcing trust. If anything, the new spec makes that boundary more important: **a header-only proxy is now not just insufficient but actively unsafe**.

If you're working through stateless MCP behind a gateway and hitting these edges, I'd genuinely like to hear about it. Reach out on [LinkedIn](https://www.linkedin.com/in/ceposta/).


---

## Try it yourself

The entire setup is one small config file. It puts agentgateway in front of a local MCP server (the reference `server-everything`), runs statelessly so every request is a self-contained POST, and adds a body-based policy that allows only the `echo` tool. Save it as `agw.yaml`:

```yaml
mcp:
  port: 3000
  statefulMode: stateless          # each request is a self-contained POST; no session handshake
  targets:
  - name: everything
    stdio:
      cmd: npx
      args: ["-y", "@modelcontextprotocol/server-everything"]
  policies:
    cors:
      allowOrigins: ["*"]
      allowHeaders: ["*"]
    mcpAuthorization:
      rules:
      - 'mcp.tool.name == "echo"'   # body-based authz: only `echo` is permitted
```

Start the gateway (needs `npx` for the stdio server):

```sh
agentgateway -f agw.yaml
# from a source checkout: cargo run -- -f agw.yaml
```

Now drive it by hand from another terminal. Every request needs `Content-Type: application/json` and `Accept: application/json, text/event-stream`.

**1. Honest call: header matches body, tool is allowlisted → forwarded**

```sh
curl -sS http://localhost:3000/mcp \
  -H 'Content-Type: application/json' -H 'Accept: application/json, text/event-stream' \
  -H 'Mcp-Method: tools/call' -H 'Mcp-Name: echo' \
  -d '{"jsonrpc":"2.0","id":1,"method":"tools/call","params":{"name":"echo","arguments":{"message":"hello"}}}'
# data: {"jsonrpc":"2.0","id":1,"result":{"content":[{"type":"text","text":"Echo: hello"}]}}
```

**2. The attack: header says `echo`, body calls `printEnv` (env exfiltration) → rejected**

```sh
curl -sS http://localhost:3000/mcp \
  -H 'Content-Type: application/json' -H 'Accept: application/json, text/event-stream' \
  -H 'Mcp-Method: tools/call' -H 'Mcp-Name: echo' \
  -d '{"jsonrpc":"2.0","id":2,"method":"tools/call","params":{"name":"printEnv","arguments":{}}}'
# {"jsonrpc":"2.0","id":2,"error":{"code":-32020,"message":"Mcp-Name header/body mismatch"}}
```

**3. Method spoof: header `tools/list`, body `tools/call` → rejected**

```sh
curl -sS http://localhost:3000/mcp \
  -H 'Content-Type: application/json' -H 'Accept: application/json, text/event-stream' \
  -H 'Mcp-Method: tools/list' -H 'Mcp-Name: echo' \
  -d '{"jsonrpc":"2.0","id":3,"method":"tools/call","params":{"name":"echo","arguments":{"message":"x"}}}'
# {"jsonrpc":"2.0","id":3,"error":{"code":-32020,"message":"Mcp-Method header/body mismatch"}}
```

**4. Honest but denied by the body policy: `printEnv` blocked, tool hidden**

Headers are consistent, but the policy allows only `echo`. Note the response says `Unknown tool` rather than "access denied": the tool's existence is hidden, not just its authorization.

```sh
curl -sS http://localhost:3000/mcp \
  -H 'Content-Type: application/json' -H 'Accept: application/json, text/event-stream' \
  -H 'Mcp-Method: tools/call' -H 'Mcp-Name: printEnv' \
  -d '{"jsonrpc":"2.0","id":4,"method":"tools/call","params":{"name":"printEnv","arguments":{}}}'
# {"jsonrpc":"2.0","id":4,"error":{"code":-32602,"message":"Unknown tool: printEnv"}}
```

---

* Explore the [docs](https://agentgateway.dev/docs/) and [get started](https://agentgateway.dev/#getting-started) today.
* Star and contribute on [GitHub](https://github.com/agentgateway/agentgateway).
* Join the conversation on [Discord](https://discord.gg/y9efgEmppm).
* Attend our weekly [community meetings](https://github.com/agentgateway/agentgateway?tab=readme-ov-file#community-meetings).