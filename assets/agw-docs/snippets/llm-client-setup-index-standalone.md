## Generate client settings in the Admin UI {#client-setup}

The standalone Admin UI includes **LLM > Client Setup**, which generates connection settings and snippets from your existing gateway URL, models, and virtual API keys. Open [http://localhost:15000/ui/llm/client-setup](http://localhost:15000/ui/llm/client-setup), select a model and key, and choose a client from the **Integration** dropdown.

Client Setup has matching guides for [curl]({{< link-hextra path="/integrations/llm-clients/curl/" >}}), [Claude Code]({{< link-hextra path="/integrations/llm-clients/claude-code/" >}}), [Claude Desktop]({{< link-hextra path="/integrations/llm-clients/claude-desktop/" >}}), [Codex]({{< link-hextra path="/integrations/llm-clients/codex/" >}}), [Cursor]({{< link-hextra path="/integrations/llm-clients/cursor/" >}}), [GitHub Copilot]({{< link-hextra path="/integrations/llm-clients/github-copilot/" >}}), and the [OpenAI SDKs]({{< link-hextra path="/integrations/llm-clients/openai-sdk/" >}}). The UI also includes OpenCode and Windsurf recipes. Continue does not currently have a recipe, and the Windsurf recipe does not directly map to the Devin Desktop guide.

Client Setup configures the client only. It does not create or modify the gateway resources and credentials that the selected client requires.
