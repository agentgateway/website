Exchange the user's Keycloak access token that a client sends to the gateway for a new access token at Keycloak, so that the backend receives a token that is issued for its own audience.

## About

{{< reuse "agw-docs/snippets/te-keycloak-about.md" >}}

### Keycloak settings {#settings}

Keycloak uses the standard RFC 8693 grant, so you configure it with the generic `oauthTokenExchange` method. The following settings are specific to Keycloak.

| Field | Value for Keycloak |
| -- | -- |
| `url` | `KEYCLOAK_URL/realms/REALM/protocol/openid-connect/token`. Keycloak checks the `iss` claim of the incoming token against this URL, so the gateway must reach Keycloak through the same hostname that issued the token. |
| `grantType` | `TokenExchange`, the default. |
| `subjectToken.tokenType` | `AccessToken`, the default. Keycloak accepts only access tokens as the subject token. |
| `requestedTokenType` | Omit, or set `AccessToken`. Keycloak also issues an `IdToken`, but rejects `Jwt`. |
| `audiences` | The client IDs of the backends that the exchanged token is for, such as `backend`. Each audience must be available to the gateway's client. If you omit this field, the exchanged token has every audience that is available to the gateway's client. |
| `scopes` | Optional. Default or optional client scopes of the gateway's client. |
| `clientAuth` | Required. The client ID and client secret of the gateway's confidential client. Set `method` to `ClientSecretBasic`, the default, or `ClientSecretPost`. |

## Before you begin

{{< reuse "agw-docs/snippets/prereq.md" >}}

4. Get admin access to a Keycloak server, version 26.2 or later. The gateway and your machine must reach Keycloak at the same URL, because Keycloak rejects an incoming token with an `iss` claim that does not match the URL that the gateway calls. If you run Keycloak in the cluster, set the issuer with the `KC_HOSTNAME` environment variable. For an example, see the [standard token exchange guide]({{< link-hextra path="/documentation/security/backend-authn/token-exchange/standard/" >}}).

5. Install [`jq`](https://jqlang.org/download/).
6. Download the Keycloak distribution and extract its `bin` directory, which has the [`kcadm.sh` admin CLI](https://www.keycloak.org/docs/latest/server_admin/#admin-cli). Then, add the directory to your `PATH`. The admin CLI requires Java 17 or later.

   ```sh
   export KEYCLOAK_VERSION={{< reuse "agw-docs/versions/keycloak.md" >}}
   curl -sL https://github.com/keycloak/keycloak/releases/download/$KEYCLOAK_VERSION/keycloak-$KEYCLOAK_VERSION.tar.gz \
     | tar xz keycloak-$KEYCLOAK_VERSION/bin
   export PATH="$PWD/keycloak-$KEYCLOAK_VERSION/bin:$PATH"
   ```

## Step 1: Configure the realm {#realm}

{{< reuse "agw-docs/snippets/te-keycloak-realm-setup.md" >}}

## Step 2: Configure token exchange {#token-exchange}

1. Create a Kubernetes Secret with the client secret of the `agentgateway` client. The policy reads the secret from the `clientSecret` key.

   ```sh
   kubectl create secret generic keycloak-client -n httpbin \
     --from-literal=clientSecret=$GATEWAY_CLIENT_SECRET
   ```

2. Create an {{< reuse "agw-docs/snippets/policy.md" >}} that exchanges the incoming token at Keycloak for every request to the httpbin app. The shell fills in your Keycloak URL and realm.

   ```yaml
   kubectl apply -f- <<EOF
   apiVersion: {{< reuse "agw-docs/snippets/api-version.md" >}}
   kind: {{< reuse "agw-docs/snippets/policy.md" >}}
   metadata:
     name: keycloak-token-exchange
     namespace: httpbin
   spec:
     targetRefs:
     - group: ""
       kind: Service
       name: httpbin
     backend:
       auth:
         oauthTokenExchange:
           url: $KEYCLOAK_URL/realms/$REALM/protocol/openid-connect/token
           grantType: TokenExchange
           audiences:
           - backend
           scopes:
           - backend.read
           clientAuth:
             clientId: agentgateway
             method: ClientSecretBasic
             secretRef:
               name: keycloak-client
   EOF
   ```

   For a description of each setting, see [Keycloak settings](#settings).

3. Confirm that the policy is accepted and attached.

   ```sh
   kubectl get {{< reuse "agw-docs/snippets/policy.md" >}} keycloak-token-exchange -n httpbin \
     -o jsonpath='{range .status.ancestors[0].conditions[*]}{.type}={.status}{"\n"}{end}'
   ```

   Example output:

   ```
   Accepted=True
   Attached=True
   ```

## Step 3: Verify the exchange {#verify}

Send a request to the httpbin `/headers` endpoint through the gateway, with the user's token, and decode the token that httpbin received. If more than 5 minutes passed since you saved the token in the `$INBOUND_TOKEN` environment variable, get a new token by repeating step 7 of the realm setup.

```sh
curl -s http://$INGRESS_GW_ADDRESS/headers \
  -H "host: www.example.com" \
  -H "authorization: Bearer $INBOUND_TOKEN" \
  | jq -r '.headers.Authorization[0] | sub("^Bearer ";"")' \
  | cut -d. -f2 \
  | jq -R 'gsub("-";"+") | gsub("_";"/") | . + ("=" * ((4 - (length % 4)) % 4)) | @base64d | fromjson | {aud, azp, sub, scope}'
```

The backend received the exchanged token, for the `backend` audience with `agentgateway` as the authorized party, not the token that you sent.

```json
{
  "aud": "backend",
  "azp": "agentgateway",
  "sub": "d7386852-9a23-44b2-b8ea-a2d81f73a014",
  "scope": "backend.read profile email"
}
```

## Next steps

The exchange does not validate the incoming token itself; Keycloak does. To reject an invalid or expired token at the gateway before it calls Keycloak, add a JWT authentication policy, as described in [Validate the incoming token at the edge]({{< link-hextra path="/documentation/security/backend-authn/token-exchange/standard/#edge-validation" >}}). Set `preserveToken: true` on that policy, so that the token is still in the request when the exchange runs.

## Troubleshooting {#troubleshooting}

When Keycloak rejects the exchange, the gateway returns `400` with the body `invalid request`. The response from Keycloak is logged at debug level. To see it, raise the log level of the token exchange module on the proxy, send the request again, and check the proxy logs.

```sh
kubectl port-forward deployment/agentgateway-proxy -n {{< reuse "agw-docs/snippets/namespace.md" >}} 15000 &
curl -X POST "http://localhost:15000/logging?level=info,agentgateway::http::auth::oauth=debug"
kubectl logs deployment/agentgateway-proxy -n {{< reuse "agw-docs/snippets/namespace.md" >}} | grep "oauth token exchange"
```

The change lasts until the proxy restarts. Look for a message such as `oauth token exchange rejected by authorization server` or `oauth token exchange rejected gateway credentials`, which includes the error from Keycloak.

{{< reuse "agw-docs/snippets/te-keycloak-errors.md" >}}

## Cleanup

{{< reuse "agw-docs/snippets/cleanup.md" >}}

1. Delete the Kubernetes resources.

   ```sh
   kubectl delete {{< reuse "agw-docs/snippets/policy.md" >}} keycloak-token-exchange -n httpbin
   kubectl delete secret keycloak-client -n httpbin
   ```

2. If you ran the admin port-forward in the troubleshooting section, stop it.

   ```sh
   pkill -f "port-forward deployment/agentgateway-proxy" || true
   ```

3. Delete the Keycloak resources. If you created the test realm, delete the realm. Otherwise, delete the `agentgateway` client and the client scopes that you created.

   ```sh
   kcadm.sh delete realms/$REALM
   ```

4. Optional: Remove the Keycloak distribution that you downloaded.

   ```sh
   rm -rf keycloak-$KEYCLOAK_VERSION
   ```
