Exchange the incoming token for a backend-scoped token with the [RFC 7523](https://datatracker.ietf.org/doc/html/rfc7523) JWT bearer grant, configured on an {{< reuse "agw-docs/snippets/policy.md" >}}.

## About

The `JwtBearer` grant sends the incoming token to the authorization server as the `assertion` rather than as the `subject_token`. Use it when the incoming token is a JWT issued by an identity provider that the authorization server trusts, but that did not itself issue the backend token.

For the default RFC 8693 exchange, see [Standard token exchange]({{< link-hextra path="/documentation/security/backend-authn/token-exchange/standard/" >}}). For an exchange that crosses a trust boundary between two authorization servers, see [Cross App Access]({{< link-hextra path="/documentation/security/backend-authn/token-exchange/cross-app-access/" >}}).

Some identity providers implement vendor-specific variants of this grant. [Microsoft Entra on-behalf-of](#entra-obo) is covered later on this page.

## Before you begin

{{< reuse "agw-docs/snippets/prereq.md" >}}

## Deploy Keycloak

{{< reuse "agw-docs/snippets/keycloak-token-exchange.md" >}}

## Configure token exchange

Configure agentgateway to exchange tokens.

1. Create an {{< reuse "agw-docs/snippets/backend.md" >}} for the token endpoint, pointing at the in-cluster Keycloak Service.

   ```yaml {paths="te-jwt-bearer"}
   kubectl apply -f- <<EOF
   apiVersion: {{< reuse "agw-docs/snippets/api-version.md" >}}
   kind: {{< reuse "agw-docs/snippets/backend.md" >}}
   metadata:
     name: keycloak-token-endpoint
     namespace: httpbin
   spec:
     static:
       host: keycloak.httpbin.svc.cluster.local
       port: 8080
   EOF
   ```

2. Create a Kubernetes Secret with the gateway client's secret. This matches the `requester-client` secret from the imported realm.

   ```yaml {paths="te-jwt-bearer"}
   kubectl apply -f- <<EOF
   apiVersion: v1
   kind: Secret
   metadata:
     name: oauth-client
     namespace: httpbin
   type: Opaque
   stringData:
     clientSecret: requester-secret
   EOF
   ```

3. Create an {{< reuse "agw-docs/snippets/policy.md" >}} that attaches the `oauthTokenExchange` method to the `httpbin` Service, with `grantType: JwtBearer`. Apart from the grant, the policy is the same as the one in the [standard token exchange guide]({{< link-hextra path="/documentation/security/backend-authn/token-exchange/standard/" >}}).

   > [!NOTE]
   > In this example, the assertion is a token from the `idp` realm, which the `backend-oauth` realm trusts through its JWT Authorization Grant identity provider. [Verify the exchange](#verify-the-exchange) shows how to mint it.

   ```yaml {paths="te-jwt-bearer"}
   kubectl apply -f- <<EOF
   apiVersion: {{< reuse "agw-docs/snippets/api-version.md" >}}
   kind: {{< reuse "agw-docs/snippets/policy.md" >}}
   metadata:
     name: backend-token-exchange
     namespace: httpbin
   spec:
     targetRefs:
     - group: ""
       kind: Service
       name: httpbin
     backend:
       auth:
         oauthTokenExchange:
           backendRef:
             group: {{< reuse "agw-docs/snippets/group.md" >}}
             kind: {{< reuse "agw-docs/snippets/backend.md" >}}
             name: keycloak-token-endpoint
           path: /realms/backend-oauth/protocol/openid-connect/token
           grantType: JwtBearer
           audiences:
           - target-client
           clientAuth:
             clientId: requester-client
             method: ClientSecretBasic
             secretRef:
               name: oauth-client
   EOF
   ```

   {{< reuse "agw-docs/snippets/oauth-token-exchange-fields.md" >}}

## Verify the exchange

Mint the incoming token, send a request through agentgateway with it, and verify that the token the gateway forwards is a different one: it is issued for the `target-client` audience with `requester-client` as the authorized party (`azp`), not the client that minted the incoming token.

1. Port-forward the Keycloak Service so that you can reach its token endpoint locally.

   ```sh
   kubectl port-forward -n httpbin svc/keycloak 8080:8080
   ```

2. In another terminal, mint the incoming token. Mint a token from the `idp` realm as `idp-app`; the gateway presents this as the RFC 7523 `assertion` to the `backend-oauth` realm, which trusts the `idp` realm. Tokens expire, so re-mint if you come back later.

   ```sh
   export INBOUND_TOKEN="$(curl -s http://localhost:8080/realms/idp/protocol/openid-connect/token \
     -u idp-app:idp-secret -d grant_type=password \
     -d username=idpuser -d password=idppass | jq -r .access_token)"
   echo $INBOUND_TOKEN
   ```

3. Send a request to the httpbin `/headers` endpoint through the gateway, with the incoming token. The gateway exchanges the token at Keycloak and forwards the request to httpbin with the *exchanged* token. Because httpbin reflects the request headers, you can see the token that the gateway forwarded.

   ```sh
   curl -s http://$INGRESS_GW_ADDRESS:80/headers \
     -H "host: www.example.com" \
     -H "authorization: Bearer $INBOUND_TOKEN"
   ```

   In the response, note that the `Authorization` header reflected by httpbin contains a *different* token than the one you sent.

4. Extract the exchanged token from the reflected `Authorization` header and decode its payload, to confirm the exchange.

   ```sh
   curl -s http://$INGRESS_GW_ADDRESS:80/headers \
     -H "host: www.example.com" \
     -H "authorization: Bearer $INBOUND_TOKEN" \
     | jq -r '.headers.Authorization | sub("^Bearer ";"")' \
     | cut -d. -f2 \
     | jq -R 'gsub("-";"+") | gsub("_";"/") | . + ("=" * ((4 - (length % 4)) % 4)) | @base64d | fromjson'
   ```

   The exchanged token is issued by `backend-oauth`, not by the `idp` realm that issued the assertion, and its authorized party (`azp`) is the gateway's client (`requester-client`). The `sub` claim is `idpuser` as `backend-oauth` knows them, so it differs from the subject in the assertion you sent.

   ```json
   {
     "iss": "http://keycloak.httpbin.svc.cluster.local:8080/realms/backend-oauth",
     "aud": "target-client",
     "azp": "requester-client",
     "sub": "6aabea9b-d35a-469c-9fd7-1c5dc2073eff"
   }
   ```

{{< doc-test paths="te-jwt-bearer" >}}
# WHAT THIS TEST VALIDATES:
#   * The same Keycloak stack, backend, and Secret apply, and the policy is accepted with
#     grantType: JwtBearer.
#   * End to end: a token minted in the `idp` realm is presented to the `backend-oauth` realm as an
#     RFC 7523 assertion, and httpbin receives a token issued by `backend-oauth` for target-client
#     with requester-client as the authorized party -- proving the realms really are federated.
# WHAT THIS TEST DOES NOT VALIDATE (and why):
#   * The port-forward in the visible steps -- local forwarding is unsupported in automated tests, so
#     the hidden test mints through the gateway instead. KC_HOSTNAME pins the issuer either way.
#   * The Microsoft Entra on-behalf-of variant -- external dependency: it needs a real Entra tenant.

# Expose the Keycloak token endpoint through the gateway so the assertion can be minted without a
# port-forward.
kubectl apply -f- <<EOF
apiVersion: gateway.networking.k8s.io/v1
kind: HTTPRoute
metadata:
  name: keycloak
  namespace: httpbin
spec:
  parentRefs:
  - name: agentgateway-proxy
    namespace: {{< reuse "agw-docs/snippets/namespace.md" >}}
  hostnames:
  - "keycloak.local"
  rules:
  - backendRefs:
    - name: keycloak
      port: 8080
EOF
{{< /doc-test >}}

{{< doc-test paths="te-jwt-bearer" >}}
YAMLTest -f - <<'EOF'
- name: wait for the jwt bearer token exchange policy to be accepted
  wait:
    target:
      kind: AgentgatewayPolicy
      metadata:
        namespace: httpbin
        name: backend-token-exchange
    jsonPath: "$.status.ancestors[0].conditions[?(@.type=='Accepted')].status"
    jsonPathExpectation:
      comparator: equals
      value: "True"
    polling:
      timeoutSeconds: 120
      intervalSeconds: 5
EOF
{{< /doc-test >}}

{{< doc-test paths="te-jwt-bearer" >}}
# Mint the assertion from the `idp` realm. Keycloak readiness and data plane programming both lag
# the rollout, and an unready upstream answers 503, so retry until a real token comes back.
mint_assertion() {
  local out=""
  for i in $(seq 1 60); do
    out=$(curl -s --max-time 10 "http://${INGRESS_GW_ADDRESS}:80/realms/idp/protocol/openid-connect/token" -H "host: keycloak.local" -u idp-app:idp-secret -d grant_type=password -d username=idpuser -d password=idppass | jq -r '.access_token // empty' 2>/dev/null || true)
    [ -n "$out" ] && { printf '%s' "$out"; return 0; }
    sleep 2
  done
  return 1
}

ASSERTION=$(mint_assertion) || { echo "FAILED: could not mint the assertion from the idp realm"; exit 1; }
test -n "$ASSERTION" || { echo "FAILED: could not mint the assertion from the idp realm"; exit 1; }

# The assertion is issued by the idp realm; the exchanged token must come from backend-oauth.
ASSERTION_ISS=$(printf '%s' "$ASSERTION" | python3 -c '
import sys,json,base64
try:
    seg=sys.stdin.read().strip().split(".")[1]
    print(json.loads(base64.urlsafe_b64decode(seg+"="*(-len(seg)%4)))["iss"])
except Exception:
    pass')
case "$ASSERTION_ISS" in
  */realms/idp) : ;;
  *) echo "FAILED: expected the assertion to be issued by the idp realm, got '$ASSERTION_ISS'"; exit 1 ;;
esac

AZP=""
RESP=""
for i in $(seq 1 30); do
  RESP=$(curl -s --max-time 15 "http://${INGRESS_GW_ADDRESS}:80/headers" -H "host: www.example.com" -H "authorization: Bearer $ASSERTION")
  AZP=$(printf '%s' "$RESP" | python3 -c '
import sys,json,base64
try:
    h=json.load(sys.stdin)["headers"]
    tok=h.get("Authorization") or h.get("authorization")
    tok=(tok[0] if isinstance(tok,list) else tok).split()[1]
    seg=tok.split(".")[1]
    print(json.loads(base64.urlsafe_b64decode(seg+"="*(-len(seg)%4)))["azp"])
except Exception:
    pass')
  [ "$AZP" = "requester-client" ] && break
  sleep 2
done
if [ "$AZP" != "requester-client" ]; then
  echo "FAILED: expected the forwarded token azp=requester-client, got '$AZP'"
  echo "last response body (first 500 chars): $(printf '%s' "$RESP" | head -c 500)"
  exit 1
fi

FWD_ISS=$(printf '%s' "$RESP" | python3 -c '
import sys,json,base64
try:
    h=json.load(sys.stdin)["headers"]
    tok=h.get("Authorization") or h.get("authorization")
    tok=(tok[0] if isinstance(tok,list) else tok).split()[1]
    seg=tok.split(".")[1]
    print(json.loads(base64.urlsafe_b64decode(seg+"="*(-len(seg)%4)))["iss"])
except Exception:
    pass')
case "$FWD_ISS" in
  */realms/backend-oauth) : ;;
  *) echo "FAILED: expected the exchanged token to be issued by backend-oauth, got '$FWD_ISS'"; exit 1 ;;
esac
echo "jwt bearer exchange verified (assertion iss=$ASSERTION_ISS -> exchanged iss=$FWD_ISS azp=$AZP)"
{{< /doc-test >}}

## Microsoft Entra on-behalf-of {#entra-obo}

The [Microsoft Entra on-behalf-of (OBO)](https://learn.microsoft.com/en-us/entra/identity-platform/v2-oauth2-on-behalf-of-flow) flow is a vendor-specific variant of the JWT bearer grant. Point the token endpoint at your Entra tenant, use `ClientSecretPost` client authentication, and add the `requested_token_use=on_behalf_of` parameter through `additionalParams`. Values in `additionalParams` are CEL expressions, so the literal string is quoted. Make sure to include your Entra `<TENANT_ID>` and `<CLIENT_ID>` values.

```yaml
kubectl apply -f- <<EOF
apiVersion: {{< reuse "agw-docs/snippets/api-version.md" >}}
kind: {{< reuse "agw-docs/snippets/policy.md" >}}
metadata:
  name: backend-token-exchange
  namespace: httpbin
spec:
  targetRefs:
  - group: ""
    kind: Service
    name: httpbin
  backend:
    auth:
      oauthTokenExchange:
        backendRef:
          group: {{< reuse "agw-docs/snippets/group.md" >}}
          kind: {{< reuse "agw-docs/snippets/backend.md" >}}
          name: entra-token-endpoint
        path: /<TENANT_ID>/oauth2/v2.0/token
        grantType: JwtBearer
        clientAuth:
          clientId: <CLIENT_ID>
          method: ClientSecretPost
          secretRef:
            name: oauth-client
        scopes:
        - https://graph.microsoft.com/.default
        additionalParams:
          requested_token_use: '"on_behalf_of"'
EOF
```

To verify this variant, mint a user access token from your Entra tenant as the incoming token, send it through the gateway, and inspect the exchanged on-behalf-of token that the gateway forwards, as in [Verify the exchange](#verify-the-exchange).

## Next steps

This guide uses a demo Keycloak and the httpbin sample app. To use token exchange in production:

* **Point at your own authorization server.** Create an {{< reuse "agw-docs/snippets/backend.md" >}} for your IdP (such as Keycloak, Microsoft Entra, Okta, Auth0, or ZITADEL). Use port `443` for automatic backend TLS. Replace the demo realm, client IDs, audiences, and Kubernetes Secret with your own.
* **Attach the policy to the backends that need scoped tokens.** Target the {{< reuse "agw-docs/snippets/policy.md" >}} at the Services or {{< reuse "agw-docs/snippets/backend.md" >}}s that require their own credential, such as MCP servers, upstream APIs, or LLM providers. Pair it with a route-level `jwtAuthentication` policy so that an invalid token is rejected before the exchange runs, as described in [Validate the incoming token at the edge]({{< link-hextra path="/documentation/security/backend-authn/token-exchange/standard/#edge-validation" >}}). That policy must set `preserveToken: true`, or the exchange finds no `subject_token`.
* **Use token exchange to preserve agent and user identity.** Token exchange lets the gateway hand each backend a narrowly scoped, per-backend token while preserving the caller's identity end-to-end. In agentic flows, the exchange can carry an agent acting on behalf of a user, so every downstream call keeps an auditable, least-privilege identity chain instead of sharing one broad credential.

## Cleanup

```sh {paths="te-jwt-bearer"}
kubectl delete {{< reuse "agw-docs/snippets/policy.md" >}} backend-token-exchange -n httpbin
kubectl delete {{< reuse "agw-docs/snippets/backend.md" >}} keycloak-token-endpoint -n httpbin
kubectl delete secret oauth-client -n httpbin
kubectl delete deployment keycloak -n httpbin
kubectl delete service keycloak -n httpbin
kubectl delete configmap backend-oauth-realm -n httpbin
```

{{< doc-test paths="te-jwt-bearer" >}}
kubectl delete httproute keycloak -n httpbin --ignore-not-found
{{< /doc-test >}}
