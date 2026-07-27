---
title: "Optimize Token Cost with Context Compression in agentgateway"
category: "Deep Dive"
publishDate: 2026-07-27
author: "Keith Babo"
description: "agentgateway introduces an extension point for token compression providing the flexibility to integrate any validated compression solution."
toc: false
---

You pay for the full context of every LLM request, and agents multiply that cost on every round trip with the model. Verbose tool results, documents quoted whole, and retrieved chunks kept "just in case" ride along on every turn. The waste adds up quickly: a 50KB tool result is roughly 12,000 tokens, paid for again on each turn of a 30-turn session, at a discount when provider caching works and at full price when it doesn't. And the cost isn't only money: [models attend less reliably to what matters when it's buried in noise](https://research.trychroma.com/context-rot).

Context compression is a promising solution to this problem, transforming the messages you're about to send so the same information costs fewer tokens. That sounds like an almost magical fix: keep the meaning, cut the bill. The reality is more nuanced. This post explores the opportunities and the challenges of compression, and shows how the new context compression support in agentgateway addresses both.

## Promise and pitfalls

Compression can be instrumented at several layers of the stack:

* Model providers offer native compaction of conversation history (Anthropic's context editing, OpenAI's Responses API compaction).  
* Agent harnesses compact on their own (Claude Code's `/compact`).  
* Libraries prune prompts inside the application (LLMLingua). And standalone engines compress requests in flight through a proxy (Headroom).

This is a very active area of development, with existing implementations announcing major improvements and new approaches launching weekly.

The promise is large, but measured results can be mixed. [JetBrains Research found](https://blog.jetbrains.com/research/2025/12/efficient-context-management/) that summarizing agent context lengthened coding-agent trajectories by 13-15%: summaries hid failure signals, so agents repeated dead-end work. Compression that rewrites cached content has been [measured costing more in total than no compression at all](https://arxiv.org/abs/2607.15516). And the same technique can range from benign to harmful depending on workload.

Any one of these approaches can address parts of the problem in isolation. A provider feature covers that provider, a harness feature covers that harness, a library covers the one app it's wired into. A platform team running many agents against many providers inherits a patchwork it can't standardize or measure, and given the mixed evidence, measurement is not optional. The solution lies in the gateway that proxies every LLM request, one place to centralize compression across every model, harness, and application.

## One extension point, any compression engine

agentgateway solves this problem with the newly added `contextCompression` policy, compatible with any compression implementation that speaks a simple wire contract:

```
POST /v1/compress
{ "messages": [ ...provider-native message objects... ], "model": "gpt-4o" }

200 OK
{ "messages": [ ...compressed message objects... ], "tokens_saved": 11500 }
```

The extension point is deliberately implementation neutral: you choose the implementation that delivers the best results for your use cases. This neutrality is a direct response to the state of the field. Techniques differ by content type: structured JSON tool output crushes to a fraction of its size, prose needs semantic selection, and source code yields the least. Results differ several-fold by workload, and the field is moving too fast to lock one algorithm into the data plane. So the gateway supplies the safe plumbing and the telemetry to judge any engine you put behind it. If a better engine ships next quarter, swapping it in is a config change.

```
llm:
  models:
  - name: "*"
    provider: openAI
    contextCompression:
      target:
        host: 127.0.0.1:8787    # any engine speaking /v1/compress
      failureMode: failOpen     # default; failClosed available
      minSizeBytes: 16384       # skip requests smaller than this (default 16KiB)
```

## Optimization with guardrails

The `contextCompression` policy is engineered for reliability, with guardrails for the common failure modes of compression. The gateway validates every engine response. If the engine returns an error, a malformed body, or output that breaks tool-call pairing (a tool result with no matching call), the compressed result is discarded. Under `failOpen`, the default, the original request is forwarded unchanged; `failClosed` rejects the request instead, for cases where policy mandates compression. Compression also fits the policy controls and telemetry agentgateway already provides. Prompt guards run before compression, so they inspect the original content. Token counting and rate limits reflect what was actually sent. And requests below `minSizeBytes` skip the engine entirely; a callout that saves a few hundred tokens costs more than it saves. The callout does add a network hop, so run the engine adjacent to the gateway and measure latency alongside cost.

The most expensive failure mode is also the least visible: busting the provider's prompt cache. Providers cache the repeated prefix of a conversation and charge substantially less for cached tokens, with discounts varying by provider. A compressor whose output changes as the conversation grows rewrites that prefix on every turn. Recent research measured a query-aware compressor costing [about 40% more in total than no compression](https://arxiv.org/abs/2607.15516), because every rewritten prefix was a cache miss. The design accounts for this. The system prompt is never sent to the compression engine, preserving the stable prefix that caching depends on. Provider cache markers survive the round trip untouched. Engines should run in deterministic, prefix-stable modes against cached providers; the runnable example below documents a cache-stable configuration for [Headroom](https://github.com/headroomlabs-ai/headroom), the compression engine it uses. The signal to watch is the provider's reported cache-read tokens: they should stay high, and a collapse means the engine is rewriting the prefix.

## Try it out yourself

Testing with real examples is the only way to measure what compression actually saves and to find which of your use cases carry the best return. The repo ships a runnable example, [examples/llm-context-compression](https://github.com/agentgateway/agentgateway/tree/yuval-k/compression-extension-point/examples/llm-context-compression), to get you started with Headroom as a pluggable compression provider:

```shell
# start Headroom, the example compression engine
docker compose -f examples/llm-context-compression/docker-compose.yaml up -d

# run the gateway with the example config
export OPENAI_API_KEY=sk-...
agentgateway -f examples/llm-context-compression/config.yaml
```

The example includes a script that generates a large, compressible reference document and a `curl` request to send it through the gateway. From there, point the config at your own traffic.

As you transition from this example to evaluating your own use cases, keep the following in mind:

1. **Total session cost**, not per-request input tokens. Savings on the way in can be outweighed by extra output, extra turns, and cache misses.  
2. **Turn counts and task success** against an uncompressed baseline on your own workload.  
3. **Cache-read tokens** holding steady across a long session, comparable across runs with compression enabled and disabled.

Compression outcomes and token counts appear in agentgateway's request telemetry; cache-read tokens come back in each provider's usage response.

The extension point makes this evaluation cheap: enable it per-route, compare, and swap or disable the engine in configuration if the numbers don't hold. The [example README](https://github.com/agentgateway/agentgateway/tree/yuval-k/compression-extension-point/examples/llm-context-compression) has the full walkthrough, including Headroom's cache-stable settings and a note on buffer sizes for very large contexts.

Try it out, and [let the community know](https://discord.gg/y9efgEmppm) about your results and which compression implementations you've found to work best!