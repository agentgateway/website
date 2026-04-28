Reduce cross-zone traffic latency by routing requests to nearby endpoints, with automatic failover to other localities when local endpoints are unavailable.

## About {#about}

Locality-aware routing (also called topology-aware routing) sends requests to backend endpoints that share locality with the gateway proxy, such as endpoints in the same zone, region, or node. {{< reuse "agw-docs/snippets/agentgateway-capital.md" >}} groups endpoints into priority buckets based on their locality relative to the gateway, then selects the best bucket on each request.

Locality applies to all backend services, not just LLM providers. The same priority-group selection that powers [LLM failover]({{< link-hextra path="/llm/failover/" >}}) handles general HTTP routing as well.

### How locality bucketing works

When you enable locality-aware routing for a Service, {{< reuse "agw-docs/snippets/agentgateway.md" >}} ranks each endpoint against the gateway's own locality. The ranking forms ordered priority buckets, with closer matches in higher-priority buckets.

1. **Same zone** as the gateway, the highest priority.
2. **Same region, different zone**, the second priority.
3. **Different region**, the fallback.

In failover mode (the default when you set `trafficDistribution` on a Service), the gateway sends requests to the highest-priority bucket that has at least one healthy endpoint. If all endpoints in that bucket are unhealthy or removed, traffic spills over to the next bucket. This way, you get locality preference without sacrificing availability.

### Failover vs. strict locality

Two enforcement levels are available.

- **Failover (default)**: Prefer local endpoints, but spill over to other localities when no local endpoints are available. Use failover for cost and latency optimization without sacrificing availability.
- **Strict**: Only deliver to endpoints that match the configured locality. If no matching endpoints exist, requests return `503 Service Unavailable` instead of spilling over. Use strict mode when locality is a hard requirement, such as data residency or same-node co-location.

You configure both modes through standard Kubernetes Service fields, not through agentgateway-specific resources.

| Behavior | Service field | Value |
| --- | --- | --- |
| Failover, prefer same zone | `spec.trafficDistribution` | `PreferClose` |
| Strict, same node only | `spec.internalTrafficPolicy` | `Local` |

### How the gateway determines its own locality

For locality-aware routing to work, the gateway proxy must know its own locality. {{< reuse "agw-docs/snippets/agentgateway-capital.md" >}} resolves this in the following order.

1. The `LOCALITY` environment variable on the proxy pod (`region/zone/subzone` format), if set.
2. The labels on the node where the proxy pod runs, `topology.kubernetes.io/region` and `topology.kubernetes.io/zone`.

If neither source provides locality information, locality preferences on Services are silently ignored. Every endpoint falls into the highest-priority bucket, and traffic is distributed without locality awareness.

## Before you begin

{{< reuse "agw-docs/snippets/prereq.md" >}}

4. Install the Istio CRDs that {{< reuse "agw-docs/snippets/agentgateway.md" >}} consumes for workload and locality discovery. Use the manifest from a recent Istio release.

   ```sh,paths="locality-aware-routing"
   kubectl apply -f https://raw.githubusercontent.com/istio/istio/release-1.27/manifests/charts/base/files/crd-all.gen.yaml
   ```

5. Verify that the nodes in your cluster carry locality labels. Cloud-provider Kubernetes distributions add these labels automatically, but local clusters such as kind do not.

   ```sh
   kubectl get nodes --label-columns=topology.kubernetes.io/region,topology.kubernetes.io/zone
   ```

   If the `REGION` and `ZONE` columns are empty, label your nodes manually. The values that you choose determine which endpoints count as "same zone" or "same region" as the gateway. For a single-node test cluster, run the following command.

   ```sh
   kubectl label node <node-name> topology.kubernetes.io/region=region topology.kubernetes.io/zone=zone --overwrite
   ```

   Restart the agentgateway controller so it picks up the updated node labels.

   ```sh
   kubectl rollout restart deployment/agentgateway -n {{< reuse "agw-docs/snippets/namespace.md" >}}
   ```

{{< doc-test paths="locality-aware-routing" >}}
NODE_NAME=$(kubectl get nodes -o jsonpath='{.items[0].metadata.name}')
kubectl label node "$NODE_NAME" topology.kubernetes.io/region=region topology.kubernetes.io/zone=zone --overwrite
kubectl rollout restart deployment/agentgateway -n agentgateway-system
kubectl rollout status deployment/agentgateway -n agentgateway-system --timeout=180s
{{< /doc-test >}}

## Set up failover across localities {#failover}

Deploy three backend instances that represent three localities, and then enable `PreferClose` on the Service so that the gateway prefers same-zone endpoints and falls back to other zones or regions only when needed.

{{< callout type="info" >}}
The example uses Istio `WorkloadEntry` resources to override locality on each backend. WorkloadEntries are required for single-node clusters such as kind, where every pod runs on the same node and shares one locality. In a real multi-zone cluster, you do not need WorkloadEntries, because each pod inherits locality from the node where it runs, and a Service selector that matches pod labels works as usual.
{{< /callout >}}

1. Create a namespace and a Gateway.

   ```yaml,paths="locality-aware-routing"
   kubectl apply -f- <<EOF
   apiVersion: v1
   kind: Namespace
   metadata:
     name: agentgateway-locality
   ---
   apiVersion: gateway.networking.k8s.io/v1
   kind: Gateway
   metadata:
     name: gateway
     namespace: agentgateway-locality
   spec:
     gatewayClassName: agentgateway
     listeners:
       - name: http
         protocol: HTTP
         port: 80
         allowedRoutes:
           namespaces:
             from: Same
   EOF
   ```

   {{< doc-test paths="locality-aware-routing" >}}
   YAMLTest -f - <<'EOF'
   - name: wait for locality Gateway to be programmed
     wait:
       target:
         kind: Gateway
         metadata:
           namespace: agentgateway-locality
           name: gateway
       jsonPath: "$.status.conditions[?(@.type=='Programmed')].status"
       jsonPathExpectation:
         comparator: equals
         value: "True"
       polling:
         timeoutSeconds: 300
         intervalSeconds: 5
   EOF
   {{< /doc-test >}}

2. Deploy three backend instances. Each instance returns its own pod hostname so you can identify which backend served a request.

   ```yaml,paths="locality-aware-routing"
   kubectl apply -f- <<EOF
   apiVersion: apps/v1
   kind: Deployment
   metadata:
     name: backend-zone-a
     namespace: agentgateway-locality
   spec:
     replicas: 1
     selector:
       matchLabels:
         app.kubernetes.io/name: backend-zone-a
     template:
       metadata:
         labels:
           app: backend-zone-a
           app.kubernetes.io/name: backend-zone-a
       spec:
         containers:
           - name: agnhost
             image: registry.k8s.io/e2e-test-images/agnhost:2.45
             args: ["netexec", "--http-port=80"]
             ports:
               - name: http
                 containerPort: 80
   ---
   apiVersion: apps/v1
   kind: Deployment
   metadata:
     name: backend-zone-b
     namespace: agentgateway-locality
   spec:
     replicas: 1
     selector:
       matchLabels:
         app.kubernetes.io/name: backend-zone-b
     template:
       metadata:
         labels:
           app: backend-zone-b
           app.kubernetes.io/name: backend-zone-b
       spec:
         containers:
           - name: agnhost
             image: registry.k8s.io/e2e-test-images/agnhost:2.45
             args: ["netexec", "--http-port=80"]
             ports:
               - name: http
                 containerPort: 80
   ---
   apiVersion: apps/v1
   kind: Deployment
   metadata:
     name: backend-region-b
     namespace: agentgateway-locality
   spec:
     replicas: 1
     selector:
       matchLabels:
         app.kubernetes.io/name: backend-region-b
     template:
       metadata:
         labels:
           app: backend-region-b
           app.kubernetes.io/name: backend-region-b
       spec:
         containers:
           - name: agnhost
             image: registry.k8s.io/e2e-test-images/agnhost:2.45
             args: ["netexec", "--http-port=80"]
             ports:
               - name: http
                 containerPort: 80
   EOF
   ```

   {{< doc-test paths="locality-aware-routing" >}}
   YAMLTest -f - <<'EOF'
   - name: wait for backend-zone-a deployment
     wait:
       target:
         kind: Deployment
         metadata:
           namespace: agentgateway-locality
           name: backend-zone-a
       jsonPath: "$.status.availableReplicas"
       jsonPathExpectation:
         comparator: greaterThan
         value: 0
       polling:
         timeoutSeconds: 180
         intervalSeconds: 5
   - name: wait for backend-zone-b deployment
     wait:
       target:
         kind: Deployment
         metadata:
           namespace: agentgateway-locality
           name: backend-zone-b
       jsonPath: "$.status.availableReplicas"
       jsonPathExpectation:
         comparator: greaterThan
         value: 0
       polling:
         timeoutSeconds: 180
         intervalSeconds: 5
   - name: wait for backend-region-b deployment
     wait:
       target:
         kind: Deployment
         metadata:
           namespace: agentgateway-locality
           name: backend-region-b
       jsonPath: "$.status.availableReplicas"
       jsonPathExpectation:
         comparator: greaterThan
         value: 0
       polling:
         timeoutSeconds: 180
         intervalSeconds: 5
   EOF
   {{< /doc-test >}}

3. Create a Service and an HTTPRoute. The Service selector matches a label that the WorkloadEntries in the next step carry, not the pod labels.

   ```yaml,paths="locality-aware-routing"
   kubectl apply -f- <<EOF
   apiVersion: v1
   kind: Service
   metadata:
     name: locality-svc
     namespace: agentgateway-locality
   spec:
     selector:
       app: locality-svc-workloadentry
     ports:
       - name: http
         port: 80
         targetPort: 80
         protocol: TCP
   ---
   apiVersion: gateway.networking.k8s.io/v1
   kind: HTTPRoute
   metadata:
     name: locality-route
     namespace: agentgateway-locality
   spec:
     parentRefs:
       - name: gateway
     hostnames:
       - locality.test
     rules:
       - backendRefs:
           - name: locality-svc
             port: 80
   EOF
   ```

   {{< doc-test paths="locality-aware-routing" >}}
   YAMLTest -f - <<'EOF'
   - name: wait for locality-route to be accepted
     wait:
       target:
         kind: HTTPRoute
         metadata:
           namespace: agentgateway-locality
           name: locality-route
       jsonPath: "$.status.parents[0].conditions[?(@.type=='Accepted')].status"
       jsonPathExpectation:
         comparator: equals
         value: "True"
       polling:
         timeoutSeconds: 120
         intervalSeconds: 5
   EOF
   {{< /doc-test >}}

4. Capture each backend pod's IP address and create a WorkloadEntry that overrides its locality. The labels on each WorkloadEntry match the Service selector, so {{< reuse "agw-docs/snippets/agentgateway.md" >}} treats them as endpoints of `locality-svc`.

   ```sh,paths="locality-aware-routing"
   ZONE_A_IP=$(kubectl get pod -n agentgateway-locality -l app=backend-zone-a -o jsonpath='{.items[0].status.podIP}')
   ZONE_B_IP=$(kubectl get pod -n agentgateway-locality -l app=backend-zone-b -o jsonpath='{.items[0].status.podIP}')
   REGION_B_IP=$(kubectl get pod -n agentgateway-locality -l app=backend-region-b -o jsonpath='{.items[0].status.podIP}')

   kubectl apply -f- <<EOF
   apiVersion: networking.istio.io/v1
   kind: WorkloadEntry
   metadata:
     name: we-zone-a
     namespace: agentgateway-locality
     labels:
       app: locality-svc-workloadentry
   spec:
     address: ${ZONE_A_IP}
     locality: "region/zone"
     ports:
       http: 80
   ---
   apiVersion: networking.istio.io/v1
   kind: WorkloadEntry
   metadata:
     name: we-zone-b
     namespace: agentgateway-locality
     labels:
       app: locality-svc-workloadentry
   spec:
     address: ${ZONE_B_IP}
     locality: "region/other-zone"
     ports:
       http: 80
   ---
   apiVersion: networking.istio.io/v1
   kind: WorkloadEntry
   metadata:
     name: we-region-b
     namespace: agentgateway-locality
     labels:
       app: locality-svc-workloadentry
   spec:
     address: ${REGION_B_IP}
     locality: "other-region/zone"
     ports:
       http: 80
   EOF
   ```

5. Get the gateway address.

   {{< tabs items="Cloud Provider LoadBalancer,Port-forward for local testing" tabTotal="2" >}}
   {{% tab tabName="Cloud Provider LoadBalancer" %}}
   ```sh,paths="locality-aware-routing"
   export INGRESS_GW_ADDRESS=$(kubectl get gateway gateway -n agentgateway-locality -o jsonpath='{.status.addresses[0].value}')
   echo $INGRESS_GW_ADDRESS
   ```
   {{% /tab %}}
   {{% tab tabName="Port-forward for local testing" %}}
   ```sh
   kubectl port-forward deployment/agentgateway-proxy -n {{< reuse "agw-docs/snippets/namespace.md" >}} 8080:80
   ```
   {{% /tab %}}
   {{< /tabs >}}

   {{< doc-test paths="locality-aware-routing" >}}
   # Warm up the new locality.test hostname so the proxy populates xDS for it.
   for i in $(seq 1 60); do
     curl -s --max-time 5 -o /dev/null "http://${INGRESS_GW_ADDRESS}/hostname" -H "host: locality.test" && break
     sleep 2
   done
   {{< /doc-test >}}

6. Send a few baseline requests. Without `trafficDistribution` set, traffic spreads across all three backends.

   ```sh
   for i in $(seq 1 10); do
     curl -s -H "host: locality.test" "http://${INGRESS_GW_ADDRESS}/hostname"
     echo
   done
   ```

   Example output:

   ```
   backend-zone-b-6bddfdcd85-ht8qn
   backend-region-b-5d46cfc8b5-xmfnc
   backend-zone-a-868fdff56f-w9jsn
   backend-region-b-5d46cfc8b5-xmfnc
   backend-region-b-5d46cfc8b5-xmfnc
   backend-region-b-5d46cfc8b5-xmfnc
   backend-zone-a-868fdff56f-w9jsn
   backend-region-b-5d46cfc8b5-xmfnc
   backend-region-b-5d46cfc8b5-xmfnc
   backend-zone-a-868fdff56f-w9jsn
   ```

7. Enable locality-aware failover by setting `trafficDistribution: PreferClose` on the Service.

   ```yaml,paths="locality-aware-routing"
   kubectl apply -f- <<EOF
   apiVersion: v1
   kind: Service
   metadata:
     name: locality-svc
     namespace: agentgateway-locality
   spec:
     selector:
       app: locality-svc-workloadentry
     ports:
       - name: http
         port: 80
         targetPort: 80
         protocol: TCP
     trafficDistribution: PreferClose
   EOF
   ```

8. Send requests again. All requests now go to `backend-zone-a`, the only backend in the same zone as the gateway.

   ```sh
   for i in $(seq 1 20); do
     curl -s -H "host: locality.test" "http://${INGRESS_GW_ADDRESS}/hostname"
     echo
   done | sort | uniq -c
   ```

   Example output:

   ```
     20 backend-zone-a-868fdff56f-w9jsn
   ```

   {{< doc-test paths="locality-aware-routing" >}}
   # Assert all requests go to backend-zone-a after PreferClose is enabled.
   EXPECTED=20
   EXPECTED_PREFIX=backend-zone-a
   for attempt in $(seq 1 12); do
     COUNT=0
     for i in $(seq 1 ${EXPECTED}); do
       body=$(curl -s --max-time 5 -H "host: locality.test" "http://${INGRESS_GW_ADDRESS}/hostname" || echo "")
       case "$body" in
         ${EXPECTED_PREFIX}-*) COUNT=$((COUNT+1)) ;;
       esac
     done
     if [ "$COUNT" -eq "$EXPECTED" ]; then
       echo "PASS: ${COUNT}/${EXPECTED} requests routed to ${EXPECTED_PREFIX}"
       break
     fi
     echo "Attempt ${attempt}: ${COUNT}/${EXPECTED} to ${EXPECTED_PREFIX}, retrying..."
     sleep 5
   done
   if [ "$COUNT" -ne "$EXPECTED" ]; then
     echo "FAIL: expected ${EXPECTED}/${EXPECTED} requests to ${EXPECTED_PREFIX}, got ${COUNT}"
     exit 1
   fi
   {{< /doc-test >}}

9. Simulate a same-zone outage by deleting the same-zone WorkloadEntry. Traffic spills over to the next bucket, which is the same region but a different zone.

   ```sh,paths="locality-aware-routing"
   kubectl delete workloadentry we-zone-a -n agentgateway-locality
   sleep 2

   for i in $(seq 1 20); do
     curl -s --max-time 5 -H "host: locality.test" "http://${INGRESS_GW_ADDRESS}/hostname"
     echo
   done | sort | uniq -c
   ```

   Example output:

   ```
     20 backend-zone-b-6bddfdcd85-ht8qn
   ```

   {{< doc-test paths="locality-aware-routing" >}}
   # Assert traffic shifts to backend-zone-b after we-zone-a is deleted.
   EXPECTED=20
   EXPECTED_PREFIX=backend-zone-b
   for attempt in $(seq 1 12); do
     COUNT=0
     for i in $(seq 1 ${EXPECTED}); do
       body=$(curl -s --max-time 5 -H "host: locality.test" "http://${INGRESS_GW_ADDRESS}/hostname" || echo "")
       case "$body" in
         ${EXPECTED_PREFIX}-*) COUNT=$((COUNT+1)) ;;
       esac
     done
     if [ "$COUNT" -eq "$EXPECTED" ]; then
       echo "PASS: ${COUNT}/${EXPECTED} requests routed to ${EXPECTED_PREFIX}"
       break
     fi
     echo "Attempt ${attempt}: ${COUNT}/${EXPECTED} to ${EXPECTED_PREFIX}, retrying..."
     sleep 5
   done
   if [ "$COUNT" -ne "$EXPECTED" ]; then
     echo "FAIL: expected ${EXPECTED}/${EXPECTED} requests to ${EXPECTED_PREFIX}, got ${COUNT}"
     exit 1
   fi
   {{< /doc-test >}}

10. Delete the same-region WorkloadEntry. Traffic spills over to the cross-region backend.

    ```sh,paths="locality-aware-routing"
    kubectl delete workloadentry we-zone-b -n agentgateway-locality
    sleep 2

    for i in $(seq 1 20); do
      curl -s --max-time 5 -H "host: locality.test" "http://${INGRESS_GW_ADDRESS}/hostname"
      echo
    done | sort | uniq -c
    ```

    Example output:

    ```
      20 backend-region-b-5d46cfc8b5-xmfnc
    ```

   {{< doc-test paths="locality-aware-routing" >}}
   # Assert traffic shifts to backend-region-b after we-zone-b is also deleted.
   EXPECTED=20
   EXPECTED_PREFIX=backend-region-b
   for attempt in $(seq 1 12); do
     COUNT=0
     for i in $(seq 1 ${EXPECTED}); do
       body=$(curl -s --max-time 5 -H "host: locality.test" "http://${INGRESS_GW_ADDRESS}/hostname" || echo "")
       case "$body" in
         ${EXPECTED_PREFIX}-*) COUNT=$((COUNT+1)) ;;
       esac
     done
     if [ "$COUNT" -eq "$EXPECTED" ]; then
       echo "PASS: ${COUNT}/${EXPECTED} requests routed to ${EXPECTED_PREFIX}"
       break
     fi
     echo "Attempt ${attempt}: ${COUNT}/${EXPECTED} to ${EXPECTED_PREFIX}, retrying..."
     sleep 5
   done
   if [ "$COUNT" -ne "$EXPECTED" ]; then
     echo "FAIL: expected ${EXPECTED}/${EXPECTED} requests to ${EXPECTED_PREFIX}, got ${COUNT}"
     exit 1
   fi
   {{< /doc-test >}}

## Set up strict same-node routing {#strict}

Use `internalTrafficPolicy: Local` to require that requests reach an endpoint on the same node as the gateway. Unlike `trafficDistribution`, strict locality does not spill over. When no local endpoints exist, requests return `503 Service Unavailable`.

1. Restore the same-zone and same-region WorkloadEntries that you deleted in the previous task.

   ```sh,paths="locality-aware-routing"
   ZONE_A_IP=$(kubectl get pod -n agentgateway-locality -l app=backend-zone-a -o jsonpath='{.items[0].status.podIP}')
   ZONE_B_IP=$(kubectl get pod -n agentgateway-locality -l app=backend-zone-b -o jsonpath='{.items[0].status.podIP}')
   REGION_B_IP=$(kubectl get pod -n agentgateway-locality -l app=backend-region-b -o jsonpath='{.items[0].status.podIP}')

   kubectl apply -f- <<EOF
   apiVersion: networking.istio.io/v1
   kind: WorkloadEntry
   metadata:
     name: we-zone-a
     namespace: agentgateway-locality
     labels:
       app: locality-svc-workloadentry
   spec:
     address: ${ZONE_A_IP}
     locality: "region/zone"
     ports:
       http: 80
   ---
   apiVersion: networking.istio.io/v1
   kind: WorkloadEntry
   metadata:
     name: we-zone-b
     namespace: agentgateway-locality
     labels:
       app: locality-svc-workloadentry
   spec:
     address: ${ZONE_B_IP}
     locality: "region/other-zone"
     ports:
       http: 80
   ---
   apiVersion: networking.istio.io/v1
   kind: WorkloadEntry
   metadata:
     name: we-region-b
     namespace: agentgateway-locality
     labels:
       app: locality-svc-workloadentry
   spec:
     address: ${REGION_B_IP}
     locality: "other-region/zone"
     ports:
       http: 80
   EOF
   ```

2. Switch the Service from `trafficDistribution` to `internalTrafficPolicy: Local`. The example uses WorkloadEntries with no node association, so no endpoints are eligible for local-only delivery.

   ```yaml,paths="locality-aware-routing"
   kubectl apply -f- <<EOF
   apiVersion: v1
   kind: Service
   metadata:
     name: locality-svc
     namespace: agentgateway-locality
   spec:
     selector:
       app: locality-svc-workloadentry
     ports:
       - name: http
         port: 80
         targetPort: 80
         protocol: TCP
     internalTrafficPolicy: Local
   EOF
   ```

3. Send requests and observe that every request returns `503`.

   ```sh
   for i in $(seq 1 10); do
     curl -s -o /dev/null -w "%{http_code}\n" -H "host: locality.test" "http://${INGRESS_GW_ADDRESS}/hostname"
   done | sort | uniq -c
   ```

   Example output:

   ```
     10 503
   ```

   In a multi-node cluster, replace the WorkloadEntries with pod-backed endpoints on the same node as the gateway to see successful responses.

   {{< doc-test paths="locality-aware-routing" >}}
   # Assert all requests return 503 under internalTrafficPolicy: Local.
   EXPECTED=10
   for attempt in $(seq 1 12); do
     COUNT=0
     for i in $(seq 1 ${EXPECTED}); do
       code=$(curl -s -o /dev/null -w "%{http_code}" --max-time 5 -H "host: locality.test" "http://${INGRESS_GW_ADDRESS}/hostname" || echo "0")
       if [ "$code" = "503" ]; then
         COUNT=$((COUNT+1))
       fi
     done
     if [ "$COUNT" -eq "$EXPECTED" ]; then
       echo "PASS: ${COUNT}/${EXPECTED} requests returned 503"
       break
     fi
     echo "Attempt ${attempt}: ${COUNT}/${EXPECTED} returned 503, retrying..."
     sleep 5
   done
   if [ "$COUNT" -ne "$EXPECTED" ]; then
     echo "FAIL: expected ${EXPECTED}/${EXPECTED} requests to return 503, got ${COUNT}"
     exit 1
   fi
   {{< /doc-test >}}

## Troubleshooting

### Locality preferences appear to be ignored

**What's happening:**

You set `trafficDistribution: PreferClose` on the Service, but traffic still spreads across endpoints in other zones.

**Why it's happening:**

The gateway proxy could not determine its own locality, so every endpoint falls into the highest-priority bucket. Common causes:

- The node where the gateway pod runs is missing the `topology.kubernetes.io/region` and `topology.kubernetes.io/zone` labels.
- The proxy started before the node labels were applied, and it cached an empty locality.
- The Istio CRDs are not installed, so locality information from `WorkloadEntry` resources is not discovered.

**How to fix it:**

1. Check the labels on the gateway proxy's node.

   ```sh
   kubectl get nodes --label-columns=topology.kubernetes.io/region,topology.kubernetes.io/zone
   ```

2. If labels are missing, apply them and restart the proxy.

   ```sh
   kubectl label node <node-name> topology.kubernetes.io/region=<region> topology.kubernetes.io/zone=<zone> --overwrite
   kubectl rollout restart deployment/agentgateway-proxy -n {{< reuse "agw-docs/snippets/namespace.md" >}}
   ```

3. As a last resort, set the `LOCALITY` environment variable on the proxy explicitly to `region/zone/subzone`. Use the `extraEnv` field in your installation values to make the override persistent.

### Strict mode returns 503 for every request

**What's happening:**

With `internalTrafficPolicy: Local`, all requests return `503 Service Unavailable`.

**Why it's happening:**

No backend endpoint runs on the same node as the gateway proxy. Strict mode does not spill over to other localities.

**How to fix it:**

Either schedule a backend pod on the gateway's node, or relax the policy to `trafficDistribution: PreferClose` so that requests can spill over to other localities when no local endpoint is available.

## Cleanup

{{< reuse "agw-docs/snippets/cleanup.md" >}}

```sh
kubectl delete namespace agentgateway-locality
```

{{< doc-test paths="locality-aware-routing" >}}
kubectl delete namespace agentgateway-locality --ignore-not-found --wait=false
{{< /doc-test >}}

## Next steps

- Combine locality-aware routing with [traffic splitting]({{< link-hextra path="/traffic-management/traffic-split/" >}}) to weight traffic across backends within each locality bucket.
- For LLM provider routing, see [Failover across LLM providers]({{< link-hextra path="/llm/failover/" >}}), which uses the same priority-bucket model with a CEL-based health policy.
