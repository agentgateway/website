[Argo Rollouts](https://argoproj.github.io/rollouts/) is a Kubernetes controller that provides advanced deployment capabilities such as blue-green, canary, canary analysis, experimentation, and progressive delivery features to Kubernetes. Because Argo Rollouts supports the {{< reuse "agw-docs/snippets/k8s-gateway-api-name.md" >}}, you can use Argo Rollouts to control how traffic is split and forwarded from the proxies that agentgateway manages to the apps in your cluster. 

## Before you begin 

{{< reuse "agw-docs/snippets/prereq.md" >}}

## Install Argo Rollouts

1. Create the `argo-rollouts` namespace and deploy the Argo Rollouts components into it. 
   ```sh
   kubectl create namespace argo-rollouts
   kubectl apply -n argo-rollouts -f https://github.com/argoproj/argo-rollouts/releases/latest/download/install.yaml
   ```

2. Change the config map for the Argo Rollouts pod to install the Argo Rollouts Gateway API plug-in as shown in the following example. Alternatively, you could install the Argo Rollouts Helm chart instead to use init containers to achieve the same thing. For more information about either method, refer to the [Argo Rollouts docs](https://rollouts-plugin-trafficrouter-gatewayapi.readthedocs.io/en/v0.11.0/installation/).

   {{< callout type="info" >}}
   This configuration is only an example. Ensure you use the correct plugin binary for your platform, such as amd64 or arm64. For more platform and version options, refer to the [releases of the Argo rollouts traffic router plugin for the Gateway API](https://github.com/argoproj-labs/rollouts-plugin-trafficrouter-gatewayapi/releases).
   {{< /callout >}}

   {{< tabs items="Linux amd64, Linux arm64" tabTotal="2" >}}
   {{% tab tabName="Linux amd64" %}}
   ```yaml
   cat <<EOF | kubectl apply -f -
   apiVersion: v1
   kind: ConfigMap
   metadata:
     name: argo-rollouts-config
     namespace: argo-rollouts
   data:
     trafficRouterPlugins: |-
       - name: "argoproj-labs/gatewayAPI"
	     # example uses amd64 and v0.11.0
	     # for other builds and versions,
	     # see https://github.com/argoproj-labs/rollouts-plugin-trafficrouter-gatewayapi/releases
         location: "https://github.com/argoproj-labs/rollouts-plugin-trafficrouter-gatewayapi/releases/download/v0.11.0/gatewayapi-plugin-amd64"
   EOF
   ```
   {{% /tab %}}
   {{% tab tabName="Linux arm64" %}}
   ```yaml
   cat <<EOF | kubectl apply -f -
   apiVersion: v1
   kind: ConfigMap
   metadata:
     name: argo-rollouts-config
     namespace: argo-rollouts
   data:
     trafficRouterPlugins: |-
       - name: "argoproj-labs/gatewayAPI"
	     # example uses arm64 and v0.11.0
	     # for other builds and versions,
	     # see https://github.com/argoproj-labs/rollouts-plugin-trafficrouter-gatewayapi/releases
         location: "https://github.com/argoproj-labs/rollouts-plugin-trafficrouter-gatewayapi/releases/download/v0.11.0/gatewayapi-plugin-linux-arm64"
   EOF
   ```
   {{% /tab %}}
   {{< /tabs >}}

3. Restart the Argo Rollouts pod to pick up the latest configuration changes. 
   ```sh
   kubectl rollout restart deployment -n argo-rollouts argo-rollouts
   ```

## Create RBAC rules for Argo

1. Create a cluster role to allow the Argo Rollouts pod to manage HTTPRoute resources. 
   {{< callout type="warning" >}}
   The following cluster role allows the Argo Rollouts pod to access and work with any resources in the cluster. Use this configuration with caution and only in test environments. 
   {{< /callout >}} 
   ```yaml
   kubectl apply -f- <<EOF
   apiVersion: rbac.authorization.k8s.io/v1
   kind: ClusterRole
   metadata:
     name: gateway-controller-role
     namespace: argo-rollouts
   rules:
     - apiGroups:
         - "*"
       resources:
         - "*"
       verbs:
         - "*"
   EOF
   ```

2. Create a cluster role binding to give the Argo Rollouts service account the permissions from the cluster role. 
   ```yaml
   kubectl apply -f- <<EOF
   apiVersion: rbac.authorization.k8s.io/v1
   kind: ClusterRoleBinding
   metadata:
     name: gateway-admin
   roleRef:
     apiGroup: rbac.authorization.k8s.io
     kind: ClusterRole
     name: gateway-controller-role
   subjects:
     - namespace: argo-rollouts
       kind: ServiceAccount
       name: argo-rollouts
   EOF
   ```

## Set up a rollout

1. Create a stable and canary service for the `httpbun` pod that you deploy in the next step.  
   ```yaml
   kubectl apply -f- <<EOF
   apiVersion: v1
   kind: Service
   metadata:
     name: httpbun-stable-service
     namespace: default
     labels:
       app: httpbun
   spec:
     selector:
       app: httpbun
     ports:
       - protocol: TCP
         port: 3090
         targetPort: 3090
     type: ClusterIP
   ---
   apiVersion: v1
   kind: Service
   metadata:
     name: httpbun-canary-service
     namespace: default
     labels:
       app: httpbun
   spec:
     selector:
       app: httpbun
     ports:
       - protocol: TCP
         port: 3090
         targetPort: 3090
     type: ClusterIP
   EOF
   ```

2. Create an Argo Rollout that deploys the `httpbun` pod. Add your stable and canary services to the `spec.strategy.canary` section. 
   ```yaml
   kubectl apply -f- <<EOF
   apiVersion: argoproj.io/v1alpha1
   kind: Rollout
   metadata:
     name: httpbun-rollout
     namespace: default
     labels:
       app: httpbun
   spec:
     replicas: 1
     selector:
       matchLabels:
         app: httpbun
     template:
       metadata:
         labels:
           app: httpbun
       spec:
         containers:
           - name: httpbun
             image: sharat87/httpbun
             env:
               - name: HTTPBUN_BIND
                 value: "0.0.0.0:3090"
             ports:
               - containerPort: 3090
     strategy:
       canary:
         stableService: httpbun-stable-service
         canaryService: httpbun-canary-service
         trafficRouting:
           plugins:
             argoproj-labs/gatewayAPI:
               httpRoute: httpbun-http-route
               namespace: default
         steps:
           - setWeight: 30
           - pause: {}
           - setWeight: 60
           - pause: { duration: 30s }
           - setWeight: 100
   EOF
   ```

3. Create an HTTPRoute resource to expose the `httpbun` pod on the HTTP gateway that you created as part of the [Get started guide]({{< link-hextra path="/quickstart">}}). The HTTP resource can serve both the stable and canary versions of your app. 
   ```yaml
   kubectl apply -f- <<EOF
   apiVersion: gateway.networking.k8s.io/v1
   kind: HTTPRoute
   metadata:
     name: httpbun-http-route
     namespace: default
   spec:
     parentRefs:
       - name: agentgateway-proxy
         namespace: agentgateway-system
     rules:
       - matches:
           - path:
               type: PathPrefix
               value: /llm/chat/completions
         backendRefs:
           - name: httpbun-stable-service
             kind: Service
             port: 3090
           - name: httpbun-canary-service
             kind: Service
             port: 3090
   EOF
   ```
3. Send a request to the `httpbun` app and verify your CLI output.
   {{< tabs items="Cloud Provider LoadBalancer,Port-forward for local testing" tabTotal="2" >}}
   {{% tab tabName="Cloud Provider LoadBalancer" %}}
   1. Get the external address of the gateway and save it in an environment variable.
        ```bash
        export INGRESS_GW_ADDRESS=$(kubectl get svc -n {{< reuse "agw-docs/snippets/namespace.md" >}} agentgateway-proxy \
          -o=jsonpath="{.status.loadBalancer.ingress[0]['hostname','ip']}")
        echo $INGRESS_GW_ADDRESS
        ```
   2. Send a standard chat completion Non-streaming request.
       ```bash
       curl -s http://$INGRESS_GW_ADDRESS/llm/chat/completions \
         -H "Content-Type: application/json" \
         -d '{
           "model": "gpt-4",
           "messages": [
             {"role": "user", "content": "Explain agentgateway in one sentence."}
           ]
         }' | jq
       ```
       Example output:
       ```json
       {
         "id": "chatcmpl-abc123",
         "object": "chat.completion",
         "created": 1748000000,
         "model": "gpt-4",
         "choices": [
           {
             "index": 0,
             "message": {
               "role": "assistant",
               "content": "This is a mock response from httpbun."
             },
             "finish_reason": "stop"
           }
         ],
         "usage": {
           "prompt_tokens": 10,
           "completion_tokens": 8,
           "total_tokens": 18
         }
       }
       ```
   {{% /tab %}}
   {{% tab tabName="Port-forward for local testing" %}}
   1. Port-forward the gateway proxy `http` pod on port 8080.
       ```bash
       kubectl port-forward deployment/agentgateway-proxy -n {{< reuse "agw-docs/snippets/namespace.md" >}} 8080:80
       ```
   2. Send a standard chat completion Non-streaming request.
       ```bash
       curl -s http://localhost:8080/llm/chat/completions \
         -H "Content-Type: application/json" \
         -d '{
           "model": "gpt-4",
           "messages": [
             {"role": "user", "content": "Explain agentgateway in one sentence."}
           ]
         }' | jq
       ```
       Example output:
       ```json
       {
         "id": "chatcmpl-abc123",
         "object": "chat.completion",
         "created": 1748000000,
         "model": "gpt-4",
         "choices": [
           {
             "index": 0,
             "message": {
               "role": "assistant",
               "content": "This is a mock response from httpbun."
             },
             "finish_reason": "stop"
           }
         ],
         "usage": {
           "prompt_tokens": 10,
           "completion_tokens": 8,
           "total_tokens": 18
         }
       }
       ```
   {{% /tab %}}
   {{< /tabs >}}

## Test the promotion

{{< callout type="info" >}}
Make sure you have installed the [argo-rollouts](https://argo-rollouts.readthedocs.io/en/stable/installation/#kubectl-plugin-installation) extension for kubectl.
{{< /callout >}}

1. Verify `httpbun` image.
   ```bash
   k get pod httpbun -o yaml | grep image:
   ```
   Example output:
   ```shell
   image: sharat87/httpbun
   image: docker.io/sharat87/httpbun
   ```

2. Check the weight difference between the stable and canary service.
   ```shell
   kubectl get httproute httpbun-http-route -o yaml
   ```
   Or use the following command to watch the promotion progress in real time.
   ```shell
   kubectl argo rollouts get rollout httpbun-rollout --watch
   ```

3. Change the manifest to use a other image to start a rollout of your app. Argo Rollouts automatically starts splitting traffic between version 1 and version 2 of the app for the duration of the rollout.
   ```sh
   kubectl argo rollouts set image httpbun-rollout httpbun=sharat87/httpbun:latest
   ```

4. Promote the rollout.
   ```sh
   kubectl argo rollouts promote httpbun-rollout
   ```

5. Check that the `httpbun` Pod is running the `latest` image.
   ```bash
   k get pod httpbun -o yaml | grep image:
   ```
   Example output:
   ```shell
   image: sharat87/httpbun:latest
   image: docker.io/sharat87/httpbun:latest
   ```

Congratulations, you successfully rolled out a new version of your app without downtime by using the HTTP gateway that is managed by agentgateway. After a rollout, you typically perform tasks such as the following: 

- **Testing**: Conduct thorough testing of your app to ensure that it functions correctly after the rollout.
- **Monitoring**: Monitor your application to detect any issues that may arise after the rollout. 
- **Documentation**: Update documentation or runbooks to reflect any changes in your application.
- **User Validation**: Have users validate that the app functions correctly and meets their requirements.
- **Performance Testing**: Depending on your app, consider conducting performance testing to ensure that your app can handle the expected load without issues.
- **Resource Cleanup**: If the rollout included changes to infrastructure or other resources, ensure that any temporary or unused resources are cleaned up to avoid incurring unnecessary costs.
- **Communication**: Communicate with your team and stakeholders to update them on the status of the rollout and any issues that were encountered and resolved.
- **Security Audit**: If your application has undergone significant changes, consider conducting a security audit to ensure that no security vulnerabilities have been introduced.

## Cleanup

{{< reuse "agw-docs/snippets/cleanup.md" >}}

1. Remove the HTTPRoute. 
   ```sh
   kubectl delete httproute httpbun-http-route
   ```

2. Remove the Argo Rollout.
   ```sh
   kubectl delete rollout httpbun-rollout
   ```

3. Remove the stable and canary services. 
   ```sh
   kubectl delete services httpbun-canary-service httpbun-stable-service
   ```

4. Remove the cluster role for the Argo Rollouts pod. 
   ```sh
   kubectl delete clusterrole gateway-controller-role -n argo-rollouts
   ```

5. Remove the cluster role binding. 
   ```sh
   kubectl delete clusterrolebinding gateway-admin 
   ```

6. Remove Argo Rollouts. 
   ```sh
   kubectl delete -n argo-rollouts -f https://github.com/argoproj/argo-rollouts/releases/latest/download/install.yaml
   kubectl delete namespace argo-rollouts
   ```