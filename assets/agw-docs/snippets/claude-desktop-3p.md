Claude Desktop sends model traffic to Anthropic by default. Third-party inference mode changes that destination to an endpoint that you operate, such as an agentgateway proxy. Anthropic made this mode generally available on July 9, 2026.

Anthropic designed the mode for organizations whose security, regulatory, or contractual requirements prevent them from sending data to Anthropic's first-party infrastructure. Prompts, responses, files, and tool outputs go only to the endpoint that you configure, and conversation history stays on the user's device. You can create an agentgateway proxy at that endpoint, so that every Claude Desktop request passes through your policies for authentication, guardrails, rate limits, and observability before it reaches a model.

Keep the following behavior in mind:

* One setting covers the whole Claude Desktop app. Chat, Cowork, and Code all send inference to the endpoint that you configure.
* Claude Desktop reads its configuration once, at launch. After you change a setting, fully quit the app and reopen it.
* The gateway URL must use HTTPS unless it is a loopback address. A plain HTTP URL on any other host fails validation with the error `Invalid custom3p enterprise config: baseUrl: must use https (or http on loopback)`.
* Managed configuration wins. When an administrator delivers settings through mobile device management (MDM), users cannot override them.

For the full list of settings, see the [Claude Desktop configuration reference](https://claude.com/docs/third-party/claude-desktop/configuration).
