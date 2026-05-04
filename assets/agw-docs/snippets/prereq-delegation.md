1. Follow the [Get started guide]({{< link-hextra path="/quickstart/" >}}) to install agentgateway.

2. Follow the [Sample app guide]({{< link-hextra path="/install/sample-app/" >}}) to create the `agentgateway-proxy` Gateway with an HTTP listener.

3. Get the external address of the agentgateway proxy and save it in an environment variable.
   {{< tabs items="Cloud Provider LoadBalancer,Port-forward for local testing" tabTotal="2" >}}
   {{% tab tabName="Cloud Provider LoadBalancer" %}}
   ```sh
   export INGRESS_GW_ADDRESS=$(kubectl get svc -n {{< reuse "agw-docs/snippets/namespace.md" >}} agentgateway-proxy -o jsonpath="{.status.loadBalancer.ingress[0]['hostname','ip']}")
   echo $INGRESS_GW_ADDRESS
   ```
   {{% /tab %}}
   {{% tab tabName="Port-forward for local testing" %}}
   ```sh
   kubectl port-forward deployment/agentgateway-proxy -n {{< reuse "agw-docs/snippets/namespace.md" >}} 8080:80
   ```
   {{% /tab %}}
   {{< /tabs >}}

4. Create the namespaces for `team1` and `team2`.
   ```sh {paths="route-delegation-prereq"}
   kubectl create namespace team1
   kubectl create namespace team2
   ```

5. Deploy the httpbin app into both namespaces. The httpbin app exposes endpoints such as `/anything/...`, `/headers`, and `/delay/N` that are useful for verifying routing and policy behavior.
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

6. Verify that the httpbin apps are up and running.
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
