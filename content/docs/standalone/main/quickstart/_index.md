---
title: Get started
weight: 10
description: Get started with the agentgateway binary.
---

Get started with agentgateway, an open source, highly available, and highly scalable data plane that brings AI connectivity for agents and tools. To learn more about agentgateway, see the [About]({{< link-hextra path="/about" >}}) section.

{{< reuse "agw-docs/snippets/kgateway-callout.md" >}}

## Install the binary {#binary}

{{% steps %}}

### Step 1: Download and install

Download and install the agentgateway binary. Alternatively, you can manually download the binary from the [agentgateway releases page](https://github.com/agentgateway/agentgateway/releases/latest).

```sh
curl -sL https://agentgateway.dev/install | bash
```

Example output:

```
  % Total    % Received % Xferd  Average Speed   Time    Time     Time     Current
                                 Dload  Upload   Total   Spent   Left    Speed
100  8878  100  8878    0     0  68998      0 --:--:-- --:--:-- --:--:-- 69359

Downloading https://github.com/agentgateway/agentgateway/releases/download/v0.4.16/agentgateway-darwin-arm64
Verifying checksum... Done.
Preparing to install agentgateway into /usr/local/bin
Password:
agentgateway installed into /usr/local/bin/agentgateway
```

### Step 2: Verify the installation

Verify that the `agentgateway` binary is installed.

```shell
agentgateway --version
```

Example output with the latest version, {{< reuse "agw-docs/versions/n-patch.md" >}}:

```json
{
  "version": "{{< reuse "agw-docs/versions/n-patch.md" >}}",
  "git_revision": "90f7b25855fb5f5fbefcc16855206040cba9b77d",
  "rust_version": "1.89.0",
  "build_profile": "release",
  "build_target": "x86_64-unknown-linux-musl"
}
```

{{% /steps %}}

## Next steps

Choose a tutorial to run agentgateway with a specific backend.

{{< cards >}}
  {{< card link="llm" title="LLM (OpenAI)" subtitle="Route requests to OpenAI's chat completions API" >}}
  {{< card link="mcp" title="MCP" subtitle="Connect to an MCP server and try tools in the Playground" >}}
  {{< card link="non-agentic-http" title="Non-agentic HTTP" subtitle="Route HTTP traffic to a backend such as httpbin" >}}
{{< /cards >}}
