Keycloak implements the RFC 8693 token exchange grant as [standard token exchange](https://www.keycloak.org/securing-apps/token-exchange#_standard-token-exchange), which is supported in Keycloak 26.2 and later and is turned on per client. The gateway is a confidential client of the realm. It sends the user's access token as the `subject_token`, and Keycloak returns a new access token for the same user (`sub`), issued for the backend's audience, with the gateway's client as the authorized party (`azp`).

```mermaid
sequenceDiagram
    participant Client
    participant AGW as agentgateway
    participant KC as Keycloak
    participant API as Backend

    Client->>AGW: Request + user's access token<br/>aud includes agentgateway
    AGW->>KC: POST /realms/REALM/protocol/openid-connect/token<br/>subject_token=user's token, audience=backend<br/>client ID and secret of agentgateway
    KC-->>AGW: Access token<br/>sub=user, aud=backend, azp=agentgateway
    AGW->>API: Request + Authorization: Bearer exchanged token
    API-->>AGW: Response
    AGW-->>Client: Response
```

The {{% conditional-text exclude-if="standalone" %}}[standard token exchange guide]({{< link-hextra path="/documentation/security/backend-authn/token-exchange/standard/" >}}){{% /conditional-text %}}{{% conditional-text include-if="standalone" %}}[standard token exchange guide]({{< link-hextra path="/documentation/configuration/security/backend-authn/token-exchange/standard/" >}}){{% /conditional-text %}} runs this exchange end to end against a sample Keycloak realm that comes preconfigured. This guide shows the realm settings that make the exchange work, so that you can set up your own realm.
