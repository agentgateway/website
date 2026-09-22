Deploy a Keycloak authorization server into your cluster to act as the token endpoint. This example imports two realms so that you can exercise both grants:

* `backend-oauth`: The resource realm that performs the exchange. It has an `initial-client` (mints the user's inbound token for the RFC 8693 grant), a confidential `requester-client` (the gateway's client, with token exchange enabled), a `target-client` audience, and `testuser` / `testpass` user credentials.
* `idp`: A separate identity provider realm that issues the `assertion` for the RFC 7523 JWT bearer grant. The `backend-oauth` realm trusts it through a JWT Authorization Grant identity provider.

Steps to deploy Keycloak:

1. Download the realm definitions and load them into a ConfigMap in the `httpbin` namespace, alongside the sample app. The `sed` command rewrites the issuer host in the import (which is pinned to `localhost:7080` for local Docker use) to the in-cluster Keycloak address, so that the realms trust each other when Keycloak runs in the cluster.

   ```sh
   BASE=https://agentgateway.dev/examples/traffic-token-exchange/jwt-authz-grant/jwtbearer-import
   for realm in backend-oauth-realm idp-realm; do
     curl -sL "$BASE/$realm.json" \
       | sed 's#http://localhost:7080#http://keycloak.httpbin.svc.cluster.local:8080#g' \
       > "$realm.json"
   done

   kubectl create configmap backend-oauth-realm -n httpbin \
     --from-file=backend-oauth-realm.json \
     --from-file=idp-realm.json
   ```

2. Deploy Keycloak and its Service into the `httpbin` namespace. The `--features=preview` flag enables Keycloak's JWT Authorization Grant, which the RFC 7523 JWT bearer grant requires. The `KC_HOSTNAME` variable pins the token issuer to the in-cluster DNS name, so that tokens minted through a port-forward and the gateway's token-exchange call agree on the issuer (`iss`). Without this, Keycloak rejects the token with an issuer mismatch.

   ```yaml
   kubectl apply -f- <<EOF
   apiVersion: apps/v1
   kind: Deployment
   metadata:
     name: keycloak
     namespace: httpbin
   spec:
     replicas: 1
     selector:
       matchLabels:
         app: keycloak
     template:
       metadata:
         labels:
           app: keycloak
       spec:
         containers:
         - name: keycloak
           image: quay.io/keycloak/keycloak:{{< reuse "agw-docs/versions/keycloak.md" >}}
           args: ["start-dev", "--import-realm", "--http-port=8080", "--features=preview"]
           env:
           - name: KC_BOOTSTRAP_ADMIN_USERNAME
             value: admin
           - name: KC_BOOTSTRAP_ADMIN_PASSWORD
             value: admin
           - name: KC_HOSTNAME
             value: "http://keycloak.httpbin.svc.cluster.local:8080"
           - name: KC_HOSTNAME_STRICT
             value: "false"
           - name: KC_HOSTNAME_BACKCHANNEL_DYNAMIC
             value: "false"
           ports:
           - containerPort: 8080
           volumeMounts:
           - name: realm
             mountPath: /opt/keycloak/data/import
             readOnly: true
         volumes:
         - name: realm
           configMap:
             name: backend-oauth-realm
   ---
   apiVersion: v1
   kind: Service
   metadata:
     name: keycloak
     namespace: httpbin
   spec:
     selector:
       app: keycloak
     ports:
     - name: http
       port: 8080
       targetPort: 8080
   EOF
   ```

3. Wait for Keycloak to be ready.

   ```sh
   kubectl rollout status deployment/keycloak -n httpbin --timeout=180s
   ```
