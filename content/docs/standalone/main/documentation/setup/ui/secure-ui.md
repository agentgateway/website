---
title: Secure the UI
weight: 30
description: Require users to log in to the UI with an OIDC policy on the gateway that serves it.
test: skip
---

{{< reuse "agw-docs/standalone/setup/ui/secure.md" >}}

## Authenticate CLI access

For programmatic access to the UI's resource API, configure an [agctl connection profile]({{< link-hextra path="/documentation/operations/config-resources/#save-connection-profiles" >}}) with an exec credential plugin. The API authentication policy must accept the credential returned by the plugin, such as a JWT bearer token. A browser OIDC session does not automatically authenticate CLI requests.

Use `agctl standalone --gateway <profile-name> get all` to verify the connection. The profile URL points to the authenticated gateway, without `/ui` or `/api`. The unauthenticated admin address remains a separate access path, as described above.
