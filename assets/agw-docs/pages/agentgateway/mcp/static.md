Route to a Model Context Protocol (MCP) server through a static address. For more information, see the [About MCP]({{< link-hextra path="/mcp/about" >}}) topic.

## Before you begin

{{< reuse "agw-docs/snippets/prereq-agentgateway.md" >}}

## Step 1: Deploy an MCP server {#mcp-server}

Deploy a Model Context Protocol (MCP) server that you want {{< reuse "agw-docs/snippets/agentgateway.md" >}} to proxy traffic to. The following example sets up a simple MCP server with one tool, `fetch`, that retrieves the content of a website URL that you pass in.

1. Create the MCP server workload. Notice the following details about the Service:
   * `appProtocol: agentgateway.dev/mcp` (required): Configure your service to use the MCP protocol. This way, the {{< reuse "agw-docs/snippets/agentgateway.md" >}} proxy uses the MCP protocol when connecting to the service.
   * `agentgateway.dev/mcp-path` annotation (optional): The default values are `/sse` for the SSE protocol or `/mcp` for the Streamable HTTP protocol. If you need to change the path of the MCP target endpoint, set this annotation on the Service.

   ```yaml
   kubectl apply -f- <<EOF
   apiVersion: apps/v1
   kind: Deployment
   metadata:
     name: mcp-website-fetcher
   spec:
     selector:
       matchLabels:
         app: mcp-website-fetcher
     template:
       metadata:
         labels:
           app: mcp-website-fetcher
       spec:
         containers:
         - name: mcp-website-fetcher
           image: ghcr.io/peterj/mcp-website-fetcher:main
           imagePullPolicy: Always
   ---
   apiVersion: v1
   kind: Service
   metadata:
     name: mcp-website-fetcher
     labels:
       app: mcp-website-fetcher
   spec:
     selector:
       app: mcp-website-fetcher
     ports:
     - port: 80
       targetPort: 8000
       appProtocol: agentgateway.dev/mcp
   EOF
   ```

2. Create a {{< reuse "agw-docs/snippets/backend.md" >}} that sets up the {{< reuse "agw-docs/snippets/agentgateway.md" >}} target details for the MCP server. 
   
   ```yaml
   kubectl apply -f- <<EOF
   apiVersion: agentgateway.dev/v1alpha1
   kind: {{< reuse "agw-docs/snippets/backend.md" >}}
   metadata:
     name: mcp-backend
   spec:
     mcp:
       targets:
       - name: mcp-target
         static:
           host: mcp-website-fetcher.default.svc.cluster.local
           port: 80
           protocol: SSE   
   EOF
   ```
   

## Step 2: Route with agentgateway {#agentgateway}

Create an HTTPRoute resource that routes to the {{< reuse "agw-docs/snippets/backend.md" >}} that you created in the previous step. Use a path match so that requests to `/mcp` go to the MCP backend and are not routed to an LLM or other backend.

```yaml
kubectl apply -f- <<EOF
apiVersion: gateway.networking.k8s.io/v1
kind: HTTPRoute
metadata:
  name: mcp
spec:
  parentRefs:
    - name: agentgateway-proxy
      namespace: {{< reuse "agw-docs/snippets/namespace.md" >}}  
  rules:
    - backendRefs:
      - name: mcp-backend
        group: agentgateway.dev
        kind: {{< reuse "agw-docs/snippets/backend.md" >}}  
EOF
```


## Step 3: Verify the connection {#verify}

Use the [MCP Inspector tool](https://modelcontextprotocol.io/docs/tools/inspector) to verify that you can connect to your sample MCP server through agentgateway.

1. Get the agentgateway address.
   
   {{< tabs items="Cloud Provider LoadBalancer,Port-forward for local testing" tabTotal="2" >}}
   {{% tab tabName="Cloud Provider LoadBalancer" %}}
   ```sh
   export INGRESS_GW_ADDRESS=$(kubectl get gateway agentgateway-proxy -n {{< reuse "agw-docs/snippets/namespace.md" >}} -o=jsonpath="{.status.addresses[0].value}")
   echo $INGRESS_GW_ADDRESS
   ```
   {{% /tab %}}
   {{% tab tabName="Port-forward for local testing"%}}
   ```sh
   kubectl port-forward deployment/agentgateway-proxy -n {{< reuse "agw-docs/snippets/namespace.md" >}}  8080:80
   ```
   {{% /tab %}}
   {{< /tabs >}}

2. From the terminal, run the MCP Inspector command. Then, the MCP Inspector opens in your browser. If the MCP inspector tool does not open automatically, run `mcp-inspector`. 
   ```sh
   npx modelcontextprotocol/inspector#{{% reuse "agw-docs/versions/mcp-inspector.md" %}}
   ```
   
3. From the MCP Inspector menu, connect to your agentgateway address as follows:
   * **Transport Type**: Select `Streamable HTTP`.
   * **URL**: Enter the agentgateway address, port, and the `/mcp` path. If your agentgateway proxy is exposed with a LoadBalancer server, use `http://<lb-address>/mcp`. In local test setups where you port-forwarded the agentgateway proxy on your local machine, use `http://localhost:8080/mcp`.
   * Click **Connect**.

   {{< reuse-image src="img/mcp-inspector-connected.png" >}}
   {{< reuse-image-dark srcDark="img/mcp-inspector-connected-dark.png" >}}

4. From the menu bar, click the **Tools** tab. Then from the **Tools** pane, click **List Tools** and select the `fetch` tool. 
5. From the **fetch** pane, in the **url** field, enter a website URL, such as `https://lipsum.com/`, and click **Run Tool**.
6. Verify that you get back the fetched URL content.

   {{< reuse-image src="img/mcp-inspector-fetch.png" >}}
   {{< reuse-image-dark srcDark="img/mcp-inspector-fetch-dark.png" >}}

## Cleanup

{{< reuse "agw-docs/snippets/cleanup.md" >}}

```sh
kubectl delete Deployment mcp-website-fetcher
kubectl delete Service mcp-website-fetcher
kubectl delete {{< reuse "agw-docs/snippets/backend.md" >}} mcp-backend
kubectl delete HTTPRoute mcp
```

