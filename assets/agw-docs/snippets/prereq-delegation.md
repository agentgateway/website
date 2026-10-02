1. Follow the [Get started guide]({{< link-hextra path="/documentation/quickstart/" >}}) to install agentgateway.

2. Follow the [Sample app guide]({{< link-hextra path="/documentation/install/sample-app/" >}}) to create the `agentgateway-proxy` Gateway with an HTTP listener.

3. Get the external address of the agentgateway proxy and save it in an environment variable.
   {{< tabs >}}
   {{% tab name="Cloud Provider LoadBalancer" %}}
   ```sh
   export INGRESS_GW_ADDRESS=$(kubectl get svc -n {{< reuse "agw-docs/snippets/namespace.md" >}} agentgateway-proxy -o jsonpath="{.status.loadBalancer.ingress[0]['hostname','ip']}")
   echo $INGRESS_GW_ADDRESS
   ```
   {{% /tab %}}
   {{% tab name="Port-forward for local testing" %}}
   ```sh
   kubectl port-forward deployment/agentgateway-proxy -n {{< reuse "agw-docs/snippets/namespace.md" >}} 8080:80
   ```
   {{% /tab %}}
   {{< /tabs >}}

4. Create the namespaces for `team1` and `team2`.
   ```sh {paths="route-delegation-prereq"}
   kubectl create namespace team1
   kubectl create namespace team2
   ```{{< version exclude-if="1.3.x,1.2.x,1.1.x,1.0.x" >}}

5. Allow the parent HTTPRoute to delegate to child HTTPRoutes in the `team1` and `team2` namespaces. A child HTTPRoute that omits the `parentRefs` field requires a ReferenceGrant in its own namespace when the parent is in a different namespace. Without the grant, the child is never attached to the parent, and requests along the delegated path return a 404 response. A child that names the parent in `parentRefs` does not need a grant.
   ```yaml {paths="route-delegation-prereq"}
   kubectl apply -f- <<EOF
   apiVersion: gateway.networking.k8s.io/v1beta1
   kind: ReferenceGrant
   metadata:
     name: allow-delegation
     namespace: team1
   spec:
     from:
     - group: gateway.networking.k8s.io
       kind: HTTPRoute
       namespace: {{< reuse "agw-docs/snippets/namespace.md" >}}
     to:
     - group: gateway.networking.k8s.io
       kind: HTTPRoute
   ---
   apiVersion: gateway.networking.k8s.io/v1beta1
   kind: ReferenceGrant
   metadata:
     name: allow-delegation
     namespace: team2
   spec:
     from:
     - group: gateway.networking.k8s.io
       kind: HTTPRoute
       namespace: {{< reuse "agw-docs/snippets/namespace.md" >}}
     to:
     - group: gateway.networking.k8s.io
       kind: HTTPRoute
   EOF
   ```{{< /version >}}

6. Deploy the httpbin app into both namespaces. The httpbin app exposes endpoints such as `/anything/...`, `/headers`, and `/delay/N` that are useful for verifying routing and policy behavior.
   ```sh {paths="route-delegation-prereq"}
   curl -sL https://raw.githubusercontent.com/kgateway-dev/kgateway/main/examples/httpbin.yaml \
     | awk 'BEGIN{skip=0} /^kind: Namespace$/{skip=1} skip==0{print} /^---$/{skip=0}' \
     | sed 's/namespace: httpbin/namespace: team1/g' \
     | kubectl apply -f -

   curl -sL https://raw.githubusercontent.com/kgateway-dev/kgateway/main/examples/httpbin.yaml \
     | awk 'BEGIN{skip=0} /^kind: Namespace$/{skip=1} skip==0{print} /^---$/{skip=0}' \
     | sed 's/namespace: httpbin/namespace: team2/g' \
     | kubectl apply -f -
   ```

   {{< doc-test paths="route-delegation-prereq" >}}
   YAMLTest -f - <<'EOF'
   - name: wait for team1 httpbin deployment to be ready
     wait:
       target:
         kind: Deployment
         metadata:
           namespace: team1
           name: httpbin
       jsonPath: "$.status.availableReplicas"
       jsonPathExpectation:
         comparator: greaterThan
         value: 0
       polling:
         timeoutSeconds: 400
         intervalSeconds: 5
   - name: wait for team2 httpbin deployment to be ready
     wait:
       target:
         kind: Deployment
         metadata:
           namespace: team2
           name: httpbin
       jsonPath: "$.status.availableReplicas"
       jsonPathExpectation:
         comparator: greaterThan
         value: 0
       polling:
         timeoutSeconds: 400
         intervalSeconds: 5
   EOF
   {{< /doc-test >}}

7. Verify that the httpbin apps are up and running.
   ```sh
   kubectl get pods -n team1
   kubectl get pods -n team2
   ```

   Example output:
   ```
   NAME                       READY   STATUS    RESTARTS   AGE
   httpbin-6bc5b79755-xlvjf   3/3     Running   0          7s
   NAME                       READY   STATUS    RESTARTS   AGE
   httpbin-6bc5b79755-twxq9   3/3     Running   0          6s
   ```
