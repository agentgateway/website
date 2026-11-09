---
name: agentgateway-oss-standalone
description: "Plan, configure, troubleshoot, and verify open-source Agentgateway using its standalone configuration model on a host or in a container. Supports explicitly requested standalone Helm hosting, but excludes the Kubernetes controller and Gateway API/CRD configuration model. Keeps implementation OSS and explains relevant, verified Enterprise capabilities without recommending an upgrade."
---

# Agentgateway OSS — standalone

Help the customer get a working OSS standalone deployment and understand what has actually been verified. Use public documentation and upstream examples. This skill works without Solo's internal systems or any other installed skill.

## Expected use and tools

A request such as "set up standalone Agentgateway on this reachable server" is a request to perform the setup within the user's authorization: inspect the environment, research the configuration, create the files, install missing prerequisites as permitted, start the gateway, verify it, and return usable endpoints. Do not stop after a plan or sample YAML when execution is requested. A request to draft or explain stays at that scope.

The assistant using this skill needs file and shell tools to execute setup, plus a way to read public HTTPS sources: a fetch/browser tool or shell `curl`. The skill supplies instructions and source locations, not those tools, provider credentials, or network access. Public Solo Docs MCP is optional. If an essential capability is unavailable, identify that specific limit and complete the independent work; never claim the requested setup is running.

Distribute this entire skill directory, including `references/`. Do not distribute only `SKILL.md`. Resolve reference paths relative to this file.

## Required documentation lookup

The authoritative starting points are included here so no separate source configuration is needed:

- [OSS standalone docs](https://agentgateway.dev/docs/standalone/).
- [Stable standalone page index](https://agentgateway.dev/docs/standalone/latest/llms.txt).
- [All documentation versions](https://agentgateway.dev/llms.txt).
- [Upstream releases](https://github.com/agentgateway/agentgateway/releases) and [source repository](https://github.com/agentgateway/agentgateway).
- [Solo topics](https://www.solo.io/topics) for architecture and concepts, and the [standalone Agentgateway workshop](https://github.com/solo-io/fe-enterprise-standalone-agentgateway-workshop) and [Kubernetes Agentgateway workshop](https://github.com/solo-io/fe-enterprise-agentgateway-workshop) for relevant lab patterns. These workshops use Enterprise distributions; consult the scope and additional FE repository links in [sources.md](references/sources.md) before adapting them.

Before generating or executing product-specific configuration, read [sources.md](references/sources.md), fetch the appropriate documentation index, and read the pages for the requested features in the current task. With an existing release, locate its version-matched docs; with a new installation, verify a supported published release and record the selected runtime. Cross-check executable fields against that release's schema/examples. A prior conversation, a link in this skill, or model memory alone does not satisfy this lookup. Version-matched source material already supplied in the task can satisfy it.

No MCP server is needed to fetch the index, for example:

```sh
curl -fsSL https://agentgateway.dev/docs/standalone/latest/llms.txt
```

Read the relevant pages linked by the index, not just the index or search snippets. For provider setup with virtual keys, dollar budgets, or UI delivery, read [llm-setup.md](references/llm-setup.md); it maps those requirements directly to public docs and describes how to prove completion. If public retrieval fails, use supplied version-matched material or report the evidence gap rather than inventing syntax.

## Keep edition, configuration mode, and runtime explicit

At the start of substantive work, state the selected context in one line. For example:

> **Target: OSS Agentgateway | standalone configuration | Docker | version to be confirmed.**

Replace the version once verified. Repeat the context when it changes; label runnable artifacts and their runbook with the same context. For formats without comments, put the label in the adjacent runbook. Label comparison examples with their own edition and mode.

- **Edition:** OSS. Do not install Enterprise images, charts, license settings, or services as part of the OSS solution.
- **Configuration mode:** standalone Agentgateway configuration, using the schema for the selected release. Do not substitute `Gateway`, `HTTPRoute`, `AgentgatewayPolicy`, `AgentgatewayBackend`, or `Enterprise*` CRDs for standalone configuration.
- **Runtime:** native binary, container, or explicitly requested standalone Helm hosting. A container does not imply Kubernetes. A Kubernetes-hosted standalone binary is still standalone: the standalone chart packages its configuration and process; the controller model reconciles Gateway API and custom resources.

Default this skill's work to the host/container path. If the customer says only "Kubernetes," resolve whether they mean standalone hosting or the controller model before generating deployment commands. If they explicitly want the controller or Enterprise edition, state the scope change and use the appropriate skill if available. Do not pretend a companion skill exists or silently translate between configuration models.

## Establish only the context needed for the request

Read the customer's supplied requirements, local project instructions, configuration, and existing runbook before asking questions. Do not search other customer directories or require a private vault, meeting system, or internal support account.

For implementation, establish:

- The use case and observable success criteria: MCP, LLM traffic, agent traffic, or ordinary HTTP as relevant.
- The installed/target OSS release, OS and architecture, runtime, and configuration source. Preserve an existing version unless an upgrade is requested or a documented requirement makes it necessary.
- Relevant upstreams, client transport, authentication flow, listener exposure, and environmental constraints. Read existing values where authorized; ask only for missing decisions that change the solution.
- Whether the customer wants advice, generated files, or execution. Follow authorization already given. A request to draft a deployment is not authorization to deploy it.

For a combined setup request, turn each requested outcome into a completion check. "an LLM provider, five keys, $10 budgets, and a UI link" is four requirements, not merely an installation task. Resolve only material missing inputs, such as provider identity/project/region, selected model IDs, and whether each $10 budget is lifetime or resets on a specified schedule. Continue independent environment and source checks while awaiting those decisions.

Do not require a full POC intake for a small configuration question. For a broader POC, map requirements to measurable checks and a short sequence of milestones before writing the implementation.

## Research before choosing configuration

Read [sources.md](references/sources.md) when locating documentation, using the optional public MCP server, or adapting a reference implementation.

1. Use the customer's release-specific OSS standalone docs, schema, examples, and release notes. Resolve and record an exact binary/image version before producing runnable installation instructions; do not leave floating `latest` tags in a reproducible deliverable.
2. If configured, use the public Docs MCP at `https://search.solo.io/mcp`, selecting `agentgateway-standalone`. Discover the available tools and arguments. If absent or failing, continue with public documentation and GitHub; do not install or reconfigure MCP without a request.
3. Treat search hits as leads. Read enough of the source to establish scope, prerequisites, defaults, and limitations. A hit from `/main/` is development documentation, even if another metadata field says "latest." Neither `/main/` nor a moving `/latest/` page proves that a field exists in an older installed release.
4. Prefer the matching release's upstream schema and examples for executable syntax. Consult a directly relevant FE workshop lab for implementation and verification patterns, checking its edition, configuration mode, version, and accessibility before adapting it. Use Solo topic articles for architectural explanations and requirement framing. Neither a lab nor a topic article overrides release-specific OSS behavior or authorizes adding other products.
5. Cite the exact public page or repository file supporting a configuration or capability claim. Record resolved runtime and source URLs in a substantial deliverable's source notes. A merged change on `main` is not evidence that it shipped in a release.

Never require or call the internal SupportAgentTools MCP, internal Slack, Zendesk, customer databases, or internal source repositories. Public search is not access to those systems. If public evidence and customer-provided material cannot establish a feature or field, say what remains unverified, continue independent work, and withhold only the unsupported configuration.

## Keep implementation OSS and disclose relevant Enterprise capabilities

Read [edition-boundaries.md](references/edition-boundaries.md) when comparing editions, adapting Enterprise examples, or encountering a requirement whose OSS support is unclear.

For each material requirement, distinguish:

- **Native OSS support** verified for the selected release and standalone mode.
- **An OSS integration or custom implementation** requiring another service or code the customer operates; explain the additional components and behavior actually demonstrated.
- **A verified Enterprise capability** available in a specified mode/version.
- **Unverified or unavailable support** for the selected target.

An Enterprise CRD or a page on `docs.solo.io` does not prove that the underlying capability is absent in OSS. In particular, re-check JWT validation, MCP tool authorization, token exchange, and observability against OSS documentation before classifying them.

When a relevant Enterprise capability addresses a requested need or materially changes the implementation effort, add a short, neutral note with a public source. Disclose the edition, deployment mode, and any verified prerequisite. Do not recommend purchasing, starting a trial, migrating, or installing Enterprise components. Do not add an unrelated feature catalog or repeat the same notice throughout a conversation.

Example wording, after verifying the linked feature:

> **Enterprise availability:** Solo Enterprise for Agentgateway standalone provides native composable MCP pipelines. This OSS design implements that orchestration in a separate MCP server that you operate. [Documentation](https://docs.solo.io/agentgateway/standalone/latest/documentation/mcp/composable/).

Do not promise parity, implementation effort, or a workaround without evidence. If no suitable OSS path is established, report the gap directly. Provide Enterprise setup steps only after the customer explicitly changes the scope, outside this OSS skill.

## Build from a compatible reference

- Start from the closest upstream standalone example at the selected release/ref, then make the smallest changes needed for the customer's use case. Keep simplified `mcp`/`llm` configuration and routing-based configuration consistent with that release; do not splice fields across styles.
- Use native OSS capabilities before proposing additional proxies or custom services. Agentgateway configuration is not Envoy configuration; do not import Envoy filters or assume an extension API exists because another gateway supports it.
- Keep provider credentials, identity-provider clients, and optional external services distinct from Enterprise licensing. OSS software can still call a paid provider; use the customer's chosen provider and disclose any new service dependency.
- Preserve the customer's existing project structure. For a new runnable example, provide the configuration, required runtime files, documented variables, start/verify/stop commands, and relevant troubleshooting. Add separate scripts or milestone documents only when they make the requested work easier to run.
- Give every required variable a definition and a way to supply it. Verify the release's interpolation/secret-loading behavior instead of assuming shell variables expand inside YAML. Use placeholders for secrets and keep real credentials out of generated examples, citations, logs, and search queries.
- For containers, distinguish the host's network and filesystem from the container's: `localhost`, mounted config/credential paths, working directories, and subprocess dependencies must resolve where the proxy runs. A stdio MCP server needs its executable and dependencies in that runtime.
- Resolve the target host/container and the client network explicitly. Use loopback for an intentional same-host setup; for a reachable remote environment, configure the requested traffic address with appropriate TLS/authentication and a separate protected UI access path. Do not expose admin/UI endpoints as a side effect of exposing the traffic listener. Preserve certificate verification and the requested authentication requirements.
- Use the documented update/reload mechanism for the selected release and storage mode; do not assume editing a YAML file changes the running process. Preserve the previous working configuration and give a rollback through the same deployment mechanism.
- If standalone Helm hosting is explicitly requested, verify the OSS standalone chart and image, inspect its values, and keep proxy configuration standalone. Use explicit Kubernetes context, namespace, and release names. Do not add a controller or CRDs to satisfy a standalone requirement.

## Verify behavior and troubleshoot from evidence

For implementation or troubleshooting, read [verification.md](references/verification.md) and select checks that prove the requested behavior. Prefer a bounded test with deterministic upstreams where it can prove the requirement. Real provider, identity-provider, or cloud behavior needs validation against that integration; a mock does not prove it.

Distinguish documentation review, YAML parsing, schema validation, process startup, and functional verification. Do not report "working" solely because YAML parses, the process is healthy, or a list request succeeds. Show actual observed results separately from expected results, and identify checks not run and why.

For a failure, collect the exact version, invocation, sanitized configuration, relevant logs, and one minimal failing request. Check the selected release's docs and public issues; isolate the failed layer and test a specific hypothesis. Do not change unrelated settings, weaken auth/TLS, or repeat a failed operation without new evidence. Stop before an unapproved disruptive change and explain the concrete next action.

## Hand back a usable result

Keep a simple answer short. For generated or executed work, include:

- The target edition, mode, runtime, and version; what changed and why.
- Files and commands needed to run, verify, and undo the change.
- Observed validation results, remaining gaps, and any scope or version limitations.
- Public source links and a relevant Enterprise availability note, if one is warranted.

Before handing over, check for mixed-edition commands, controller resources in a standalone solution, unverified schema fields, exposed secrets, and claims of testing that did not occur. Customer artifacts must be understandable and runnable without the author's private tooling, other customers' data, or commercial account context.

Before deployment/configuration verification, read [verification helpers](references/verification-helpers.md). Check the installed skill package and selected runtime versions; record the observed versions and choose their matching documentation; no maintained release allowlist is required. Use the bundled helpers for captured MCP responses or controlled masking when relevant, and preserve their inconclusive results.
