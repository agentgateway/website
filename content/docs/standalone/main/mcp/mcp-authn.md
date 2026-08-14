---
title: MCP authentication
weight: 30
description: Configure OAuth 2.0 and JWT authentication for MCP servers
prev: /mcp/connect
test: skip
---

MCP authentication protects MCP servers with OAuth 2.0. Agentgateway acts as a resource server: it validates the tokens that your authorization server issues, serves the protected resource metadata that MCP clients discover, and adapts to the OAuth behavior of each supported identity provider.

For the policy reference, including the authorization server proxy, resource server only, and passthrough scenarios, the supported providers, authentication modes, and JWT claim validation, see [MCP authentication]({{< link-hextra path="/configuration/security/mcp-authn" >}}).

## Identity provider guides

For end-to-end setup with a specific identity provider, including registering the application and connecting an MCP client, see the following guides.

{{< cards >}}
  {{< card path="/integrations/auth/auth0" title="Auth0" subtitle="Use an Auth0 tenant and API as the authorization server." >}}
  {{< card path="/integrations/auth/authentik" title="authentik" subtitle="Use a self-hosted authentik instance with a pre-registered client ID." >}}
  {{< card path="/integrations/auth/descope" title="Descope" subtitle="Use a Descope project as the authorization server." >}}
  {{< card path="/integrations/auth/entra" title="Microsoft Entra ID" subtitle="Use an Entra app registration, with metadata and registration bridging." >}}
  {{< card path="/integrations/auth/keycloak" title="Keycloak" subtitle="Use a Keycloak realm, with proxied client registration." >}}
  {{< card path="/integrations/auth/okta" title="Okta" subtitle="Use an Okta org authorization server with an explicit JWKS URL." >}}
{{< /cards >}}

## Related

{{< cards >}}
  {{< card path="/mcp/mcp-authz" title="MCP authorization" subtitle="Control which tools and resources authenticated clients can reach." >}}
  {{< card link="https://learncloudnative.com/blog/2026-08-14-7-practical-mcp-policies-agentgateway" title="7 practical MCP policies" subtitle="Community blog post with worked authentication, authorization, and guardrail recipes." icon="external-link" >}}
{{< /cards >}}
