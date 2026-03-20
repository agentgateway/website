Agentgateway exposes an OpenAI-compatible API that works with any tool or SDK built for OpenAI. Point your AI coding tool at the agentgateway address and it routes requests to your configured backend provider, applying any policies you have set up such as authentication, rate limiting, or observability.

## Before you begin

- Agentgateway running with at least one configured LLM backend.
- The gateway address and model name from your backend configuration.

## Supported clients

{{< cards >}}
  {{< card link="cursor" title="Cursor" subtitle="AI code editor with custom model support" >}}
  {{< card link="windsurf" title="Windsurf" subtitle="AI code editor by Codeium" >}}
  {{< card link="continue" title="VS Code Continue" subtitle="Open source AI code assistant" >}}
  {{< card link="github-copilot" title="GitHub Copilot" subtitle="AI pair programmer (Business/Enterprise)" >}}
  {{< card link="openai-sdk" title="OpenAI SDK" subtitle="Python and Node.js SDKs" >}}
  {{< card link="curl" title="curl" subtitle="Command-line HTTP client" >}}
{{< /cards >}}
