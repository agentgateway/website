Source the TLS identity of your gateway from the SPIFFE Workload API. The gateway then presents a short-lived X.509-SVID, instead of a certificate that you store in a Secret.

## About SPIFFE workload identity

[SPIFFE](https://spiffe.io/) is a set of standards for workload identity. A SPIFFE identity is a URI, such as `spiffe://example.org/ns/spiffe-demo/sa/my-app`. A workload proves that identity with an X.509-SVID. An X.509-SVID is a short-lived certificate that carries the URI in a Subject Alternative Name (`SAN`).

When you enable SPIFFE, the gateway fetches its X.509-SVID and the trust bundle from a SPIFFE Workload API endpoint on the local node. The gateway rotates both automatically. You do not create a Secret, and you do not reference a certificate in your Gateway resource.

To get an SVID, the gateway needs a SPIFFE Workload API provider. [SPIRE](https://spiffe.io/docs/latest/spire-about/) is the reference implementation, and this guide uses it. Any provider that implements the Workload API works.

### Three separate opt-ins

Review the following table for the three settings that control SPIFFE. Each setting is independent, and you enable only the ones that you need.

| Setting | Where you set it | What it does |
| -- | -- | -- |
| `spiffe` | {{< reuse "agw-docs/snippets/gatewayparameters.md" >}} `spec` | Mounts the Workload API socket into the gateway pod and points the gateway at it. |
| `agentgateway.dev/tls-certificate-source: SPIFFE` | Gateway `spec.listeners[].tls.options` | The listener serves the SVID of the gateway, and requires a client SVID. |
| `certificateSource: SPIFFE` | {{< reuse "agw-docs/snippets/policy.md" >}} `spec.backend.tls` | The gateway presents its SVID to a backend, and verifies the certificate of the backend. |

> [!IMPORTANT]
> The `spiffe` setting alone does not change how the gateway handles traffic. The setting only mounts the socket and configures the endpoint. Listeners and backends must opt in separately.

### What SPIFFE does not support

Review the following limits before you plan a SPIFFE rollout.

* **Federation across trust domains.** The gateway accepts only the SVIDs that chain to the trust bundle of its own trust domain.
* **TLS tuning on a SPIFFE listener.** A SPIFFE listener rejects `cipherSuites`, `minProtocolVersion`, `maxProtocolVersion`, and `keyExchangeGroups`. The listener uses TLS 1.2 and TLS 1.3.
* **Session resumption.** A resumed handshake skips certificate revalidation, so the gateway disables resumption in both directions.
* **Connection lifetime that follows SVID expiry.** The gateway checks a certificate at the handshake only. To bound how long a connection outlives an SVID, set a maximum connection duration.

## Before you begin

{{< reuse "agw-docs/snippets/prereq.md" >}}

## Install SPIRE

Install a SPIRE server, a SPIRE agent, and the SPIFFE CSI driver. The CSI driver publishes the Workload API socket to a pod as a volume, which is how the gateway reads it.

1. Add the SPIRE Helm repository.

   ```sh {paths="spiffe"}
   helm repo add spire https://spiffe.github.io/helm-charts-hardened/
   helm repo update spire
   ```

2. Install the SPIRE custom resource definitions (CRDs).

   ```sh {paths="spiffe"}
   helm install spire-crds spire/spire-crds \
     --version {{< reuse "agw-docs/versions/spire-crds-chart.md" >}} \
     --namespace spire-server \
     --create-namespace \
     --wait
   ```

3. Install SPIRE. The `trustDomain` value sets the domain part of every SPIFFE ID that SPIRE issues in this cluster.

   ```sh {paths="spiffe"}
   helm install spire spire/spire \
     --version {{< reuse "agw-docs/versions/spire-chart.md" >}} \
     --namespace spire-server \
     --set global.spire.trustDomain=example.org \
     --set spiffe-oidc-discovery-provider.enabled=false \
     --timeout 8m \
     --wait
   ```

4. Verify that the SPIRE server, the SPIRE agent, and the CSI driver run.

   ```sh
   kubectl get pods -n spire-server
   ```

   Example output:

   ```
   NAME                            READY   STATUS    RESTARTS   AGE
   spire-agent-8xxxx               1/1     Running   0          63s
   spire-server-0                  2/2     Running   0          63s
   spire-spiffe-csi-driver-x2mc5   2/2     Running   0          63s
   ```

5. Verify that the CSI driver registered under the name that agentgateway uses by default.

   ```sh
   kubectl get csidrivers csi.spiffe.io
   ```

> [!NOTE]
> The SPIRE Helm chart creates a default `ClusterSPIFFEID` resource that registers every pod outside the `spire-server` and `spire-system` namespaces. The resource assigns each pod the SPIFFE ID `spiffe://<trust-domain>/ns/<namespace>/sa/<service-account>`. Because of this default, the rest of this guide creates no SPIRE registration entries by hand.

{{< doc-test paths="spiffe" >}}
YAMLTest -f - <<'EOF'
- name: wait for the SPIRE server to be ready
  wait:
    target:
      kind: StatefulSet
      metadata:
        namespace: spire-server
        name: spire-server
    jsonPath: "$.status.readyReplicas"
    jsonPathExpectation:
      comparator: equals
      value: 1
    polling:
      timeoutSeconds: 300
      intervalSeconds: 5
EOF
{{< /doc-test >}}

## Enable the Workload API on the gateway

1. Create a namespace for the gateway and the sample workloads.

   ```sh {paths="spiffe"}
   kubectl create namespace spiffe-demo
   ```

2. Create an {{< reuse "agw-docs/snippets/gatewayparameters.md" >}} resource that turns on SPIFFE. An empty `spiffe` block opts in with the default settings, which source the socket from the SPIFFE CSI driver.

   ```yaml {paths="spiffe"}
   kubectl apply -f- <<EOF
   apiVersion: {{< reuse "agw-docs/snippets/api-version.md" >}}
   kind: {{< reuse "agw-docs/snippets/gatewayparameters.md" >}}
   metadata:
     name: spiffe-params
     namespace: spiffe-demo
   spec:
     spiffe: {}
   EOF
   ```

   Review the following table for the fields that you can set in the `spiffe` block.

   | Field | Description |
   | -- | -- |
   | `enabled` | Turns SPIFFE on or off for this gateway. Omit the field to opt in through the presence of the `spiffe` block. Set the field to `false` on a Gateway-level {{< reuse "agw-docs/snippets/gatewayparameters.md" >}} resource to opt a single gateway out of SPIFFE that you enabled at the GatewayClass level. |
   | `source.csi.driver` | Name of the CSI driver that publishes the socket. Defaults to `csi.spiffe.io`. |
   | `source.hostPath.path` | Directory on the host node that holds the socket, such as `/run/spire/agent-sockets`. Set either `csi` or `hostPath`, never both. |
   | `source.mountPath` | Directory inside the container where the gateway reads the socket. Must be an absolute path. Defaults to `/spiffe-workload-api`. |
   | `source.socketName` | Filename of the socket inside the mount directory. Defaults to `spire-agent.sock`. |

   > [!WARNING]
   > The `source.hostPath` option mounts a directory from the host node into the gateway pod. Anyone who can set the field can read that directory. Prefer `source.csi`, and restrict `hostPath` to a GatewayClass-level {{< reuse "agw-docs/snippets/gatewayparameters.md" >}} resource that only cluster administrators change.

3. Create a Gateway that references the {{< reuse "agw-docs/snippets/gatewayparameters.md" >}} resource. The listener sets the `agentgateway.dev/tls-certificate-source` option to `SPIFFE`, which makes the listener serve the SVID of the gateway. The listener sets no `certificateRefs`, because the gateway gets its certificate from the Workload API.

   ```yaml {paths="spiffe"}
   kubectl apply -f- <<EOF
   apiVersion: gateway.networking.k8s.io/v1
   kind: Gateway
   metadata:
     name: spiffe-gw
     namespace: spiffe-demo
   spec:
     gatewayClassName: {{< reuse "agw-docs/snippets/gatewayclass.md" >}}
     infrastructure:
       parametersRef:
         group: {{< reuse "agw-docs/snippets/group.md" >}}
         kind: {{< reuse "agw-docs/snippets/gatewayparameters.md" >}}
         name: spiffe-params
     listeners:
     - name: spiffe-https
       port: 8443
       protocol: HTTPS
       tls:
         mode: Terminate
         options:
           agentgateway.dev/tls-certificate-source: SPIFFE
       allowedRoutes:
         namespaces:
           from: Same
   EOF
   ```

   > [!IMPORTANT]
   > A SPIFFE listener always requires mutual TLS. Every client must present an SVID that chains to the trust bundle of the gateway. You cannot make inbound mTLS optional on a SPIFFE listener.

4. Verify that the gateway is programmed and that the listener is accepted.

   ```sh
   kubectl get gateway spiffe-gw -n spiffe-demo -o yaml
   ```

   In the output, the `Programmed` condition of the gateway and the `Accepted` condition of the `spiffe-https` listener both report `status: "True"`.

5. Verify that the control plane wrote the Workload API endpoint into the configuration of the gateway.

   ```sh
   kubectl get configmap spiffe-gw -n spiffe-demo -o jsonpath='{.data.config\.yaml}'
   ```

   Example output:

   ```yaml
   config:
     spiffe:
       endpoint: unix:///spiffe-workload-api/spire-agent.sock
   ```

6. Verify that the control plane mounted the socket into the gateway pod.

   ```sh
   kubectl get pod -n spiffe-demo -l gateway.networking.k8s.io/gateway-name=spiffe-gw \
     -o jsonpath='{.items[0].spec.volumes[?(@.name=="spiffe-workload-api")]}'
   ```

   Example output:

   ```json
   {"csi":{"driver":"csi.spiffe.io","readOnly":true},"name":"spiffe-workload-api"}
   ```

> [!NOTE]
> The gateway logs `No identity issued yet; waiting before retry` for a few seconds at startup, and the readiness probe fails during that time. The messages are expected. SPIRE registers a pod only after the pod exists, so the first few attempts to fetch an SVID find no entry. The gateway retries with a backoff, and fails to start rather than serving traffic without an identity.

{{< doc-test paths="spiffe" >}}
YAMLTest -f - <<'EOF'
- name: wait for the SPIFFE gateway to be programmed
  wait:
    target:
      kind: Gateway
      metadata:
        namespace: spiffe-demo
        name: spiffe-gw
    jsonPath: "$.status.conditions[?(@.type=='Programmed')].status"
    jsonPathExpectation:
      comparator: equals
      value: "True"
    polling:
      timeoutSeconds: 180
      intervalSeconds: 5
- name: wait for the SPIFFE listener to be accepted
  wait:
    target:
      kind: Gateway
      metadata:
        namespace: spiffe-demo
        name: spiffe-gw
    jsonPath: "$.status.listeners[?(@.name=='spiffe-https')].conditions[?(@.type=='Accepted')].status"
    jsonPathExpectation:
      comparator: equals
      value: "True"
    polling:
      timeoutSeconds: 180
      intervalSeconds: 5
EOF
{{< /doc-test >}}

## Deploy a route and a SPIFFE client

A SPIFFE listener requires a client SVID, so you cannot test the listener from your local machine. The client must run in the cluster, where it reads its own SVID from the Workload API.

1. Deploy the httpbin sample app, and route to it from the SPIFFE listener.

   ```yaml {paths="spiffe"}
   kubectl apply -f- <<EOF
   apiVersion: v1
   kind: ServiceAccount
   metadata:
     name: httpbin
     namespace: spiffe-demo
   ---
   apiVersion: apps/v1
   kind: Deployment
   metadata:
     name: httpbin
     namespace: spiffe-demo
   spec:
     replicas: 1
     selector:
       matchLabels:
         app: httpbin
     template:
       metadata:
         labels:
           app: httpbin
       spec:
         serviceAccountName: httpbin
         containers:
         - name: httpbin
           image: mccutchen/go-httpbin:v2.15.0
           ports:
           - containerPort: 8080
   ---
   apiVersion: v1
   kind: Service
   metadata:
     name: httpbin
     namespace: spiffe-demo
   spec:
     selector:
       app: httpbin
     ports:
     - port: 8000
       targetPort: 8080
   ---
   apiVersion: gateway.networking.k8s.io/v1
   kind: HTTPRoute
   metadata:
     name: httpbin
     namespace: spiffe-demo
   spec:
     parentRefs:
     - name: spiffe-gw
       namespace: spiffe-demo
       sectionName: spiffe-https
     rules:
     - backendRefs:
       - name: httpbin
         port: 8000
   EOF
   ```

2. Deploy a client that fetches its own SVID from the Workload API. The init container mounts the CSI volume and writes the SVID, the private key, and the trust bundle to a shared volume. The `curl` container then reads those files.

   ```yaml {paths="spiffe"}
   kubectl apply -f- <<EOF
   apiVersion: v1
   kind: ServiceAccount
   metadata:
     name: spiffe-client
     namespace: spiffe-demo
   ---
   apiVersion: apps/v1
   kind: Deployment
   metadata:
     name: spiffe-client
     namespace: spiffe-demo
   spec:
     replicas: 1
     selector:
       matchLabels:
         app: spiffe-client
     template:
       metadata:
         labels:
           app: spiffe-client
       spec:
         serviceAccountName: spiffe-client
         initContainers:
         - name: fetch-svid
           image: ghcr.io/spiffe/spire-agent:{{< reuse "agw-docs/versions/spire.md" >}}
           command: ["/opt/spire/bin/spire-agent"]
           args:
           - api
           - fetch
           - x509
           - -socketPath
           - /spiffe-workload-api/spire-agent.sock
           - -write
           - /svid
           volumeMounts:
           - name: spiffe-workload-api
             mountPath: /spiffe-workload-api
             readOnly: true
           - name: svid
             mountPath: /svid
         containers:
         - name: curl
           image: curlimages/curl:8.11.1
           command: ["sh", "-c", "sleep infinity"]
           securityContext:
             runAsUser: 0
           volumeMounts:
           - name: svid
             mountPath: /svid
         volumes:
         - name: spiffe-workload-api
           csi:
             driver: csi.spiffe.io
             readOnly: true
         - name: svid
           emptyDir: {}
   EOF
   ```

   > [!NOTE]
   > The init container restarts a few times with an `Init:Error` status before it succeeds, for the same reason that the gateway retries at startup. SPIRE needs to register the pod first.
   >
   > The `runAsUser: 0` setting on the `curl` container is necessary because the init container writes the private key with `0600` permissions and root ownership. The `curl` image runs as a non-root user, which cannot read that file.

3. Verify that the client holds an SVID.

   ```sh
   kubectl exec -n spiffe-demo deploy/spiffe-client -c curl -- ls /svid
   ```

   Example output:

   ```
   bundle.0.pem
   svid.0.key
   svid.0.pem
   ```

{{< doc-test paths="spiffe" >}}
YAMLTest -f - <<'EOF'
- name: wait for httpbin to be available
  wait:
    target:
      kind: Deployment
      metadata:
        namespace: spiffe-demo
        name: httpbin
    jsonPath: "$.status.readyReplicas"
    jsonPathExpectation:
      comparator: equals
      value: 1
    polling:
      timeoutSeconds: 180
      intervalSeconds: 5
- name: wait for the SPIFFE client to be available
  wait:
    target:
      kind: Deployment
      metadata:
        namespace: spiffe-demo
        name: spiffe-client
    jsonPath: "$.status.readyReplicas"
    jsonPathExpectation:
      comparator: equals
      value: 1
    polling:
      timeoutSeconds: 300
      intervalSeconds: 5
EOF
{{< /doc-test >}}

## Verify mutual TLS

1. Send a request with the client SVID. The request succeeds.

   ```sh {paths="spiffe"}
   kubectl exec -n spiffe-demo deploy/spiffe-client -c curl -- \
     curl -sS -k --cert /svid/svid.0.pem --key /svid/svid.0.key \
     -o /dev/null -w "%{http_code}\n" \
     https://spiffe-gw.spiffe-demo.svc.cluster.local:8443/get
   ```

   Example output:

   ```
   200
   ```

   > [!NOTE]
   > The command passes `-k` to turn off hostname verification in `curl`, not to turn off mutual TLS. An SVID carries a `spiffe://` URI SAN and carries no DNS SAN, so a hostname check can never pass against an SVID. The gateway still verifies the client SVID of the caller. The next step proves that the check happens.

2. Send a request without the client SVID. The handshake fails, which shows that the listener requires a client certificate.

   ```sh
   kubectl exec -n spiffe-demo deploy/spiffe-client -c curl -- \
     curl -sS -k https://spiffe-gw.spiffe-demo.svc.cluster.local:8443/get
   ```

   Example output:

   ```
   curl: (56) OpenSSL SSL_read: error:0A00045C:SSL routines::tlsv13 alert certificate required
   ```

3. Verify that the gateway serves its own SVID, and that the certificate chains to the SPIRE trust bundle. The `Verify return code: 0 (ok)` line confirms the chain.

   ```sh
   kubectl exec -n spiffe-demo deploy/spiffe-client -c curl -- sh -c \
     'apk add --no-cache openssl >/dev/null 2>&1;
      echo | openssl s_client -connect spiffe-gw.spiffe-demo.svc.cluster.local:8443 \
        -cert /svid/svid.0.pem -key /svid/svid.0.key -CAfile /svid/bundle.0.pem 2>/dev/null \
      | openssl x509 -noout -ext subjectAltName'
   ```

   Example output:

   ```
   X509v3 Subject Alternative Name:
       URI:spiffe://example.org/ns/spiffe-demo/sa/spiffe-gw
   ```

{{< doc-test paths="spiffe" >}}
# WHAT THIS TEST VALIDATES:
#   * SPIRE installs and issues SVIDs in a kind cluster, and the SPIFFE CSI driver
#     registers under the csi.spiffe.io name that agentgateway defaults to.
#   * `spec.spiffe: {}` on AgentgatewayParameters makes the control plane write
#     config.spiffe.endpoint into the proxy ConfigMap and mount the CSI volume.
#   * A listener with the agentgateway.dev/tls-certificate-source: SPIFFE option and
#     NO certificateRefs is accepted and programmed, which is the part a reader is
#     most likely to get wrong.
#   * The listener enforces mTLS: a request with a client SVID returns 200 and a
#     request without one fails the handshake. This guards the STRICT mTLS behavior,
#     which is not configurable and is not visible in the API reference.
#   * source.spiffeId populates from the verified client certificate, and an
#     authorization policy on it allows one identity and denies another.
# WHAT THIS TEST DOES NOT VALIDATE (and why):
#   * SVID rotation. SPIRE issues a one-hour SVID by default, so a rotation test
#     would need to either shorten the TTL well below anything realistic or run for
#     an hour.
#   * The source.hostPath option. Mounting a host directory needs a SPIRE agent that
#     publishes its socket to a hostPath rather than through the CSI driver, which is
#     a different SPIRE install than the one this guide documents.
YAMLTest -f - <<'EOF'
- name: request with a client SVID succeeds
  retries: 30
  command:
    command: 'kubectl exec -n spiffe-demo deploy/spiffe-client -c curl -- curl -sS -k --cert /svid/svid.0.pem --key /svid/svid.0.key -o /dev/null -w "%{http_code}" https://spiffe-gw.spiffe-demo.svc.cluster.local:8443/get'
  source:
    type: local
  expect:
    exitCode: 0
    stdout:
      contains: "200"
- name: a request without a client SVID fails the handshake
  retries: 5
  command:
    command: 'kubectl exec -n spiffe-demo deploy/spiffe-client -c curl -- curl -sS -k -o /dev/null -w "%{http_code}" https://spiffe-gw.spiffe-demo.svc.cluster.local:8443/get || true'
  source:
    type: local
  expect:
    exitCode: 0
    stdout:
      contains: "000"
EOF
{{< /doc-test >}}

## Restrict access by SPIFFE ID

The listener accepts any SVID that chains to the trust bundle of the trust domain. To allow only specific identities, write an authorization policy against the `source.spiffeId` attribute. This attribute holds the SPIFFE ID that the gateway read from the verified client certificate.

1. Create an {{< reuse "agw-docs/snippets/policy.md" >}} resource that allows only the client that you deployed.

   ```yaml {paths="spiffe"}
   kubectl apply -f- <<EOF
   apiVersion: {{< reuse "agw-docs/snippets/api-version.md" >}}
   kind: {{< reuse "agw-docs/snippets/policy.md" >}}
   metadata:
     name: spiffe-authz
     namespace: spiffe-demo
   spec:
     targetRefs:
     - kind: HTTPRoute
       name: httpbin
       group: gateway.networking.k8s.io
     traffic:
       authorization:
         action: Allow
         policy:
           matchExpressions:
           - 'source.spiffeId == "spiffe://example.org/ns/spiffe-demo/sa/spiffe-client"'
   EOF
   ```

   > [!NOTE]
   > Use `source.spiffeId` rather than `source.identity`. The `source.identity` attribute is an object, and the gateway populates the attribute only for a SPIFFE ID in the Istio format `spiffe://<trust-domain>/ns/<namespace>/sa/<service-account>`. The `source.spiffeId` attribute is a string, and the gateway populates the attribute for any SPIFFE ID.

2. Verify that the allowed identity still reaches the app.

   ```sh {paths="spiffe"}
   kubectl exec -n spiffe-demo deploy/spiffe-client -c curl -- \
     curl -sS -k --cert /svid/svid.0.pem --key /svid/svid.0.key \
     -o /dev/null -w "%{http_code}\n" \
     https://spiffe-gw.spiffe-demo.svc.cluster.local:8443/get
   ```

   Example output:

   ```
   200
   ```

3. Deploy a second client that uses a different service account, and therefore gets a different SPIFFE ID.

   ```sh {paths="spiffe"}
   kubectl get deploy spiffe-client -n spiffe-demo -o yaml \
     | sed 's/spiffe-client/spiffe-other/g' \
     | kubectl apply -f -
   kubectl create serviceaccount spiffe-other -n spiffe-demo
   ```

4. Send a request from the second client. The gateway completes the handshake, because the SVID is valid. The gateway then denies the request, because the SPIFFE ID does not match the policy.

   ```sh {paths="spiffe"}
   kubectl rollout status deploy/spiffe-other -n spiffe-demo --timeout=300s
   kubectl exec -n spiffe-demo deploy/spiffe-other -c curl -- \
     curl -sS -k --cert /svid/svid.0.pem --key /svid/svid.0.key \
     -o /dev/null -w "%{http_code}\n" \
     https://spiffe-gw.spiffe-demo.svc.cluster.local:8443/get
   ```

   Example output:

   ```
   403
   ```

{{< doc-test paths="spiffe" >}}
YAMLTest -f - <<'EOF'
- name: wait for the authorization policy to be accepted
  wait:
    target:
      kind: {{< reuse "agw-docs/snippets/policy.md" >}}
      metadata:
        namespace: spiffe-demo
        name: spiffe-authz
    jsonPath: "$.status.ancestors[0].conditions[?(@.type=='Accepted')].status"
    jsonPathExpectation:
      comparator: equals
      value: "True"
    polling:
      timeoutSeconds: 120
      intervalSeconds: 5
- name: the allowed SPIFFE ID still reaches the app
  retries: 20
  command:
    command: 'kubectl exec -n spiffe-demo deploy/spiffe-client -c curl -- curl -sS -k --cert /svid/svid.0.pem --key /svid/svid.0.key -o /dev/null -w "%{http_code}" https://spiffe-gw.spiffe-demo.svc.cluster.local:8443/get'
  source:
    type: local
  expect:
    exitCode: 0
    stdout:
      contains: "200"
- name: an unauthorized SPIFFE ID is denied
  retries: 30
  command:
    command: 'kubectl exec -n spiffe-demo deploy/spiffe-other -c curl -- curl -sS -k --cert /svid/svid.0.pem --key /svid/svid.0.key -o /dev/null -w "%{http_code}" https://spiffe-gw.spiffe-demo.svc.cluster.local:8443/get'
  source:
    type: local
  expect:
    exitCode: 0
    stdout:
      contains: "403"
EOF
{{< /doc-test >}}

## Troubleshoot

Review the following table for the errors that a SPIFFE setup most often produces.

| Symptom | Cause |
| -- | -- |
| The gateway pod never becomes ready, and logs `No identity issued yet; waiting before retry` for longer than a minute. | SPIRE has no registration entry for the pod. Check the `ClusterSPIFFEID` resources, and check that the namespace of the gateway is not excluded. |
| The gateway pod logs `connect to SPIFFE workload API` and then exits. | The socket is missing or empty. Check that the CSI driver runs, and that the `source.mountPath` and `source.socketName` values match where the driver publishes the socket. |
| A request fails with `tlsv13 alert certificate required`. | The client sent no client certificate. A SPIFFE listener always requires mutual TLS. |
| A request fails in `curl` with a certificate verification error, although the gateway logs no error. | An SVID carries no DNS SAN, so `curl` cannot verify the hostname. Verify the chain with `openssl s_client` instead. |
| A request to a backend fails with `backend TLS is configured for SPIFFE, but SPIFFE is not enabled`. | A policy sets `certificateSource: SPIFFE`, but no {{< reuse "agw-docs/snippets/gatewayparameters.md" >}} resource for the gateway sets `spiffe`. This failure happens per request, not at startup. |

## Clean up the SPIFFE resources

{{< reuse "agw-docs/snippets/cleanup.md" >}}

1. Delete the sample workloads, the gateway, and the namespace.

   ```sh
   kubectl delete namespace spiffe-demo
   ```

2. Uninstall SPIRE.

   ```sh
   helm uninstall spire -n spire-server
   helm uninstall spire-crds -n spire-server
   kubectl delete namespace spire-server
   ```

## Next steps

* To originate mutual TLS from the gateway to a backend with the SVID of the gateway, see [BackendTLS]({{< link-hextra path="/security/backendtls/#spiffe" >}}).
* To review every field that the `spiffe` block accepts, see the [{{< reuse "agw-docs/snippets/gatewayparameters.md" >}} reference]({{< link-hextra path="/reference/api/#spiffespec" >}}).
* To review the attributes that you can use in an authorization policy, see [Variables and functions]({{< link-hextra path="/reference/cel/variables/" >}}).
