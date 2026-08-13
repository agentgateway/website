> [!WARNING]
> **Set the bearer token type to ID token.** With the access token setting, Entra ID returns a Microsoft Graph token that validation against your tenant JWKS rejects with `InvalidSignature`. The ID token carries the client ID as its audience, which matches the configured audience.
