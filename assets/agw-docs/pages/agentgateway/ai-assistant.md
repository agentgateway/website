Let your AI coding assistant set up agentgateway for you. Unlike the other getting-started guides, this guide does not route traffic through agentgateway to an AI backend. Instead, you install a skill: a packaged set of instructions that teaches your assistant, such as Claude Code or Codex, how to install, configure, and troubleshoot agentgateway for your edition and deployment mode.

After you install the skill, your assistant reads the current public documentation, inspects your actual runtime, and verifies the behavior that you request.

{{% conditional-text include-if="standalone" %}}
**Target: OSS standalone configuration.** Run agentgateway on your selected reachable host, VM, server, or container environment. A laptop is one possible target. Standalone Helm hosting also uses this configuration model. For Gateway API and controller-managed resources, use the [Kubernetes skill guide](/docs/kubernetes/latest/documentation/quickstart/ai-assistant/).
{{% /conditional-text %}}
{{% conditional-text include-if="kubernetes" %}}
**Target: OSS Kubernetes controller and Gateway API.** Work in the selected cluster through its existing Helm or GitOps owner. For host/container deployment or standalone configuration hosted with Helm, use the [standalone skill guide](/docs/standalone/latest/documentation/quickstart/ai-assistant/).
{{% /conditional-text %}}

> [!NOTE]
> These skills are a preview. Review generated changes and verify them in your environment. To set up agentgateway yourself instead, follow the other [getting-started guides]({{< link-hextra path="/documentation/quickstart/" >}}).

## Why use a skill?

The skill gives your assistant a repeatable workflow: identify the deployment, retrieve applicable documentation, make the requested change, and check the result. It separates configuration generation from a running deployment and keeps OSS and Enterprise capabilities explicit.

It has no fixed gateway release requirement or expiry date. Your assistant discovers the actual runtime and selects the corresponding documentation and schemas. A new gateway release does not require a new skill release. Public documentation and workshops provide the source material; no Solo account or internal support tools are needed. Public [Solo documentation search](https://search.solo.io/) is optional.

Installing a skill adds instructions to your assistant. Gateway changes happen when you request them, through the assistant's existing tools and permissions.

## Before you begin

Use Claude Code, Codex, or another assistant that can load a complete `SKILL.md` folder. Setup needs file/shell access to the selected environment and access to public HTTPS documentation. Choose your provider and credential source; keep secret values out of prompts.

{{% conditional-text include-if="standalone" %}}
Identify the target host or container environment, how your assistant can access it, the existing configuration owner, and the network from which clients and your browser connect. API and UI addresses must be reachable from that network. An administrative UI may use a protected hostname or an authorized tunnel; it does not need to be exposed publicly.
{{% /conditional-text %}}
{{% conditional-text include-if="kubernetes" %}}
Identify the cluster context, gateway and controller namespaces, and existing Helm/GitOps owner. Have the necessary cluster access, `kubectl`, and Helm available. Provider credentials must work inside the proxy workload; credentials on the operator's workstation are separate.
{{% /conditional-text %}}

## Install and load the skill

From your project directory, use a current Node.js LTS and Git to install the selected skill. Review the installer's proposed changes. The commands follow the repository's current skill content; there is no skill or gateway version to bump.

{{< tabs >}}
{{< tab name="Claude Code" >}}
```sh
npx skills add agentgateway/website --skill {{< param skillName >}} --agent claude-code
```
{{< /tab >}}
{{< tab name="Codex CLI" >}}
```sh
npx skills add agentgateway/website --skill {{< param skillName >}} --agent codex
```
{{< /tab >}}
{{< tab name="Other assistants" >}}
Use your client's identifier from the [skills installer](https://github.com/vercel-labs/skills), or install the complete ZIP in its documented skill directory. A client must load relative references as well as `SKILL.md`.
{{< /tab >}}
{{< /tabs >}}

These commands install into the current project. Add `-g` only for a personal installation across projects. Codex uses `.agents/skills`, which other compatible assistants can also discover.

### ZIP alternative

Download the [current {{< param skillName >}} package]({{< param skillDownload >}}). [Checksums and content fingerprints](/downloads/agent-skills/current/manifest.json) identify the exact contents without dates or release numbers. Extract the whole folder, including `references/`, `scripts/`, and `package.json`.

{{< tabs >}}
{{< tab name="Claude Code" >}}
```sh
mkdir -p .claude/skills
unzip -n "$HOME/Downloads/{{< param skillName >}}.zip" -d .claude/skills
```
{{< /tab >}}
{{< tab name="Codex CLI" >}}
```sh
mkdir -p .agents/skills
unzip -n "$HOME/Downloads/{{< param skillName >}}.zip" -d .agents/skills
```
{{< /tab >}}
{{< tab name="Other assistants" >}}
Copy the complete `{{< param skillName >}}` directory into your client's documented project skill location. Manual extraction needs no Node.js.
{{< /tab >}}
{{< /tabs >}}

For an existing installation, use the update instructions below instead of merging files into an older folder.

### Load and check the skill

Open your assistant in the project and enter the following at its prompt:

{{< tabs >}}
{{< tab name="Claude Code" >}}
```text
/{{< param skillName >}} Identify your edition, deployment mode, content fingerprint, and documentation sources. Do not change the deployment yet.
```
{{< /tab >}}
{{< tab name="Codex CLI" >}}
```text
${{< param skillName >}} Identify your edition, deployment mode, content fingerprint, and documentation sources. Do not change the deployment yet.
```
{{< /tab >}}
{{< tab name="Other assistants" >}}
Select `{{< param skillName >}}` through your client's skill mechanism and ask it to identify the same information.
{{< /tab >}}
{{< /tabs >}}

If discovery fails, check that the skill directory directly contains `SKILL.md` and start a new session in that project.

## Set up your first provider

Choose the provider you use. The assistant should resolve missing target/provider inputs, preserve existing configuration, run one bounded request, and return the verified API endpoint and protected UI access path. A test request can incur normal provider charges.

**OpenAI**

```text
Set up agentgateway in my selected deployment environment for OpenAI.
Use my chosen model and existing provider secret source; ask for either if missing.
Preserve the configuration owner. Verify a request through the gateway and show
me the reachable API endpoint, protected UI access path, and rollback commands.
```

**Gemini through Vertex AI**

```text
Connect Gemini through Google Cloud Vertex AI in my selected deployment environment.
Confirm the Google Cloud project, region/location, model, and workload identity or ADC.
Use Vertex AI authentication, rather than a Gemini Developer API key.
Verify a request from the actual gateway workload and show API and UI access details.
```

**Amazon Bedrock**

```text
Connect my Bedrock models in the selected deployment environment.
Confirm AWS region, model or inference-profile IDs, and the gateway's IAM identity.
Verify a request through the gateway and return the reachable API endpoint,
protected UI access path, and stop or rollback commands for these changes.
```

For preparation only, begin with “Prepare the files without deploying or starting anything.” If access or credentials are missing, the assistant should finish independent preparation and identify the checks it could not perform.

## Check versions and behavior

Ask the assistant to inspect the actual gateway version before validating configuration. In controller mode it also checks the deployed controller, proxy images, and CRDs. The skill has no maintained release allowlist. It uses the discovered runtime to choose documentation and validation methods, preserving your existing deployment version.

The optional bundled helpers need Python 3.10+. They inspect package integrity/runtime evidence, classify captured MCP tool responses, and check controlled masking examples. Results distinguish a passed check, failure, and an inconclusive result. Neither a version observation nor valid YAML proves a working deployment.

## Continue with your own tasks

**Independent identities and budgets**

```text
Give five agents separate identities and a $10 budget each per fixed 24-hour window.
Check what my edition and deployment mode can enforce. Verify independent accounting,
model prices, persistence, and a bounded enforcement test. Keep credentials out of chat.
If the requested dollar enforcement is unavailable, explain the gap before choosing an alternative.
```

Standalone and controller cost-control surfaces can differ. A token quota is not an exact dollar allowance, and post-response charging/concurrent requests can overshoot a threshold. Consult the current budget documentation for your deployment before relying on enforcement.

**JWT identity and MCP code mode**

```text
I want budgets tied to authenticated JWT identities and MCP code mode.
Check native OSS support for each requirement in this deployment. Distinguish
claim-keyed token limits from dollar enforcement. Keep implementation OSS and
explain any relevant Enterprise capability with a public source.
```

A relevant Enterprise availability note is informational. It does not change editions or install licensed components. The skill checks capabilities separately rather than treating all JWT or MCP features as Enterprise-only.

**Troubleshooting**

```text
Requests through my gateway fail. Inspect the actual runtime and configuration,
identify the failed layer, make the smallest authorized correction, and verify it.
Preserve unrelated settings and report any remaining unrun checks.
```

## Update, remove, or share

For repository installations, inspect installed packages and update the selected skill:

```sh
npx skills list --json
npx skills update {{< param skillName >}} --project
```

Back up local customizations outside skill directories first: updates can replace them. Start a new assistant session afterward. Use `--global` instead of `--project` for an intentional personal installation.

For manual ZIP installations, download the current ZIP and replace the complete folder after backing it up. Keep its content fingerprint with any bug report. Sharing that ZIP gives another person the same reviewed instructions without requiring a repository commit.

```sh
npx skills remove {{< param skillName >}}
```

This removes the selected skill across project clients. Client-specific removal can leave `.agents/skills` present because several clients share it. Removing a skill does not stop a gateway or remove its configuration, credentials, resources, or accounting data.

For feedback, [open a website issue](https://github.com/agentgateway/website/issues/new) with the content fingerprint, assistant/runtime information, deployment mode, sanitized request, and observed result. Keep credentials and customer data out of the report.
