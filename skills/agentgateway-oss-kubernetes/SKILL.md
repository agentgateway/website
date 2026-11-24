---
name: agentgateway-oss-kubernetes
description: "Configure, deploy, troubleshoot, and verify OSS Agentgateway using the Kubernetes controller, Gateway API, and release-matched CRDs. Covers LLM and MCP routing, identity, cost controls, and UI access. Excludes standalone configuration, including a standalone Helm chart."
---

# OSS Agentgateway — Kubernetes controller

Help the customer produce a working, verifiable controller-based deployment. This skill is self-contained and uses public sources; it needs no internal Solo systems or other installed skill. Distribute the whole directory, including `references/`.

## Act on the requested outcome

"Set up" or "deploy" requests execution within the user's existing authorization: inspect the target, research the release, prepare the files, deploy permitted changes, verify behavior, and return usable endpoints. Do not stop at YAML when execution was requested. "Draft", "review", and "explain" remain at their stated scope.

Execution needs shell/file tools, Kubernetes access for the selected cluster, and public HTTPS retrieval through a browser/fetch tool or `curl`. Search MCP is optional. If a required tool or credential is absent, finish independent work and identify the specific blocked action; do not claim a running deployment. Use supplied project context before asking for missing decisions. Do not inspect other customers' directories or require a private vault, meeting tool, or support account.

## State and preserve the target

Begin substantive work with a line such as:

> **Target: OSS Agentgateway | Kubernetes controller / Gateway API | context and namespace to be confirmed | version to be confirmed.**

Resolve those values, use explicit context/namespace in commands, and label generated artifacts/runbooks with them. Repeat the target when it changes; label any comparison separately.

Kubernetes hosting and Kubernetes configuration are different choices. This skill manages controller resources, not a standalone `config.yaml` mounted in a Pod. A request for a standalone Helm chart belongs to the standalone skill for the selected edition. If a runtime or edition conflicts with this skill, clarify only that conflict and continue independent research. Do not silently introduce a cluster for a laptop request, switch editions, or assume a companion skill is installed.

Keep the implementation OSS: use the upstream controller, compatible CRDs, and OSS data plane. Do not install Enterprise charts, images, license settings, `Enterprise*` resources, or Solo extension services as part of an OSS solution. Additional OSS services are allowed only when they are necessary for the requested behavior and clearly identified as customer-operated dependencies.

When a relevant, publicly verified Enterprise capability changes the options, disclose its edition and mode neutrally with a source. Do not recommend an upgrade, trial, purchase, or installation. An Enterprise resource name does not prove that OSS lacks the underlying feature. Check native OSS JWT, MCP authorization, token exchange, guardrails, and telemetry before proposing middleware.

## Retrieve authoritative material before configuration

Start at [OSS Agentgateway Kubernetes docs](https://agentgateway.dev/docs/kubernetes/latest/), the [stable page index](https://agentgateway.dev/docs/kubernetes/latest/llms.txt), and the [edition/version index](https://agentgateway.dev/llms.txt). Read [sources.md](references/sources.md) when choosing documentation or adapting a workshop.

Fetch the relevant pages in the current task before writing product-specific YAML or commands. A link in this skill or model memory is not source retrieval; supplied version-matched material can satisfy it. For an existing deployment, preserve its version unless an upgrade is requested or a documented requirement makes it necessary. For a new one, verify a published supported release, record controller/chart/image versions, and check the Kubernetes/Gateway API compatibility matrix. Cross-check executable fields against the matching CRDs, chart values, and examples. Moving `/latest/`, `/main/`, and workshop branches do not prove older release support.

If public Docs MCP is configured, use product `agentgateway-kubernetes` after discovering its live schema. Read full context, and cite exact public pages or repository files. Keep the resolved runtime and source URLs in substantial deliverables. If evidence conflicts, resolve it before emitting executable syntax; otherwise mark the specific field or behavior unverified.

For substantial documentation research, suggest the optional public [Solo Docs MCP server](https://search.solo.io) at `https://search.solo.io/mcp` if the customer's assistant supports MCP. Direct HTTPS docs are sufficient. Configure it only if the customer asks, following the client's current instructions. It is separate from internal SupportAgentTools.

## Establish the minimum context

Determine the requested LLM/MCP/HTTP behavior and observable completion criteria, then inspect the authorized project's configuration and runbook. Establish the intended kube context, namespace, existing controller/CRD/chart ownership, GatewayClass, gateway, route hostname/path, provider/identity inputs, and desired exposure. Read existing settings where authorized; do not dump Secrets or environment credentials.

For "OpenAI, Bedrock, or Gemini on Vertex AI; five keys; $10 each; and a UI link", treat routing, five identities, five budget allowances, and UI access as separate requirements. Resolve provider-specific project/region/model or inference-profile IDs, workload credentials, and budget reset semantics when missing. A successful AWS CLI request on the laptop does not prove the proxy Pod has credentials. Ask only for inputs that materially affect the result and continue independent work while waiting.

For a small question, avoid a full POC intake. For a broader deployment, map each requirement to an implementation and verification check. Read [llm-setup.md](references/llm-setup.md) for model/key/budget/UI work and [edition-boundaries.md](references/edition-boundaries.md) for feature comparisons.

## Implement through the controller

Read [deployment.md](references/deployment.md) for installation, updates, and UI handling.

- Reuse a compatible example and preserve existing GitOps/Helm ownership. Inspect and render chart values before applying. CRDs and GatewayClasses are cluster-scoped even when a Helm release has a namespace; account for other workloads before changing them.
- Keep controller, CRDs, Gateway API, and proxy versions compatible. Do not invent values, use a floating development build by default, or assume Helm automatically upgrades every CRD.
- Trace the actual resource chain: GatewayClass/controller → Gateway/listener → HTTPRoute/backend or supported model resource → policy attachment → upstream. Verify reference groups, kinds, namespaces, selectors, allowed route kinds, cross-namespace grants where required, and policy precedence. A manifest accepted by Kubernetes does not prove that the controller attached or delivered it.
- Use models and their built-in LLM paths only where the selected release supports them. Check for listener/path conflicts with existing HTTPRoutes before enabling model routing. Preserve custom paths, rewrites, authentication, and client model aliases.
- Define every variable and how it is supplied. Prefer supported key hashes for client-key configuration; store plaintext credentials only through protected customer-owned files/Secrets. Shell variables do not expand in arbitrary YAML files. Avoid credential values in command arguments, logs, generated examples, or source notes.
- Distinguish local host, Pod, Service, and external addresses. Keep local port-forwards on loopback. Exposing the traffic endpoint does not authorize exposing an admin or management UI. Preserve TLS verification and requested authentication.
- Apply changes through the existing deployment mechanism. Keep a scoped rollback and preserve shared databases, counters, keys, CRDs, and releases. Do not reset usage or rotate identities merely to make a test pass.

## Verify behavior and hand over

Use [verification.md](references/verification.md) to choose checks for the requested behavior. Separate rendering/schema validation, Kubernetes admission, controller conditions/config delivery, and end-to-end transactions. A ready Pod, `Accepted` condition, or successful tool list is not functional completion.

Use bounded mocks when they prove the relevant behavior. Real provider/IAM, identity-provider, and UI interactions require their own checks; report gaps accurately. Perform already-authorized smoke tests without asking again, and do not expand them into expensive traffic, destructive failure tests, or unrelated infrastructure changes.

For failures, collect versions, sanitized manifests/status/events/logs, and one minimal request. Investigate the failed layer; change one relevant factor and retry only with new evidence. Do not disable auth/TLS to make the test pass.

Return the edition/mode/version and cluster target, changed files, apply/verify/rollback commands, verified API/UI endpoints, protected credential-file location where relevant, and source links. Separate observed results from expectations and explicitly mark unrun checks. Include a brief relevant Enterprise-availability note for OSS requests when warranted; do not add an unsolicited feature catalog.

Before deployment/configuration verification, read [verification helpers](references/verification-helpers.md). Check the installed skill package and selected runtime versions; record the observed versions and choose their matching documentation; no maintained release allowlist is required. Use the bundled helpers for captured MCP responses or controlled masking when relevant, and preserve their inconclusive results.
