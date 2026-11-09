Okta implements the RFC 8693 token exchange grant as [On-Behalf-Of Token Exchange](https://developer.okta.com/docs/guides/set-up-token-exchange/main/). A service app sends a user's access token from a custom authorization server as the `subject_token`, and Okta returns a new access token for the same user, issued for the audience and scopes that the service app requests. The new token names the user in its `sub` claim and the service app in its `act` claim, so the backend knows both who the request is for and who is acting for them.

In this guide, agentgateway is the service app. The client sends the user's Okta access token to the gateway, and the gateway exchanges it for each request to the backend. The backend receives a token that was issued for its own audience and scopes, not the token that the client sent.

```mermaid
sequenceDiagram
    participant Client
    participant AGW as agentgateway
    participant Okta as Okta custom authorization server
    participant API as Backend

    Client->>AGW: Request + user's Okta access token
    AGW->>Okta: POST /oauth2/AUTH_SERVER_ID/v1/token<br/>subject_token=user's token<br/>audience, scope<br/>client ID and secret of the service app
    Okta-->>AGW: Access token for the backend<br/>sub=user, act.sub=service app
    AGW->>API: Request + Authorization: Bearer exchanged token
    API-->>AGW: Response
    AGW-->>Client: Response
```

Unlike the Google Security Token Service, Okta authenticates the caller of the exchange. The gateway needs the client ID and client secret of an Okta API Services app that has the Token Exchange grant.
