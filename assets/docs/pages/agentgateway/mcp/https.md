## About this guide 

In this guide, you configure your agentgateway proxy to connect to the remote [GitHub MCP server](https://github.com/github/github-mcp-server) by using the HTTPS protocol. The server allows you to interact with GitHub repositories, issues, pull requests, and more. All connections to the server must be secured via HTTPS and a GitHub access token must be provided for authentication. 

## Before you begin

Set up an [agentgateway proxy]({{< link-hextra path="/setup" >}}). 

## Connect to the MCP server

1. Create a personal access token in GitHub and save it in an environment variable. For more information, see the [GitHub docs](https://docs.github.com/en/authentication/keeping-your-account-and-data-secure/managing-your-personal-access-tokens).
   ```sh
   export GH_PAT=<personal-access-token>
   ```

2. Create the {{< reuse "agw-docs/snippets/backend.md" >}} for the remote GitHub MCP server. The server requires you to connect to it by using the HTTPS protocol. Because of that, you set the `mcp.targets.static.port` field to 443.
   
   ```yaml
   kubectl apply -f- <<EOF
   apiVersion: agentgateway.dev/v1alpha1
   kind: AgentgatewayBackend
   metadata:
     name: github-mcp-backend
     namespace: {{< reuse "agw-docs/snippets/namespace.md" >}}
   spec:
     mcp:
       targets:
       - name: mcp-target
         static:
           host: api.githubcopilot.com
           port: 443
           path: /mcp/
           policies:  
             tls:
               sni: api.githubcopilot.com       
   EOF
   ```
3. Create an HTTPRoute that routes traffic to the GitHub MCP server along the `/mcp-github` path. To properly connect to the MCP server, you must allow traffic from `http://localhost:8080`, which is the domain and port you expose your agentgateway proxy on later. If you expose the proxy under a different domain, make sure to add this domain to the allowed origins. Because the MCP server also requires a GitHub access token to connect, you set the `Authorization` header to the token that you created earlier. 
   ```yaml
   kubectl apply -f- <<EOF
   apiVersion: gateway.networking.k8s.io/v1
   kind: HTTPRoute
   metadata:
     name: mcp-github
     namespace: {{< reuse "agw-docs/snippets/namespace.md" >}}
   spec:
     parentRefs:
     - name: agentgateway-proxy
       namespace: {{< reuse "agw-docs/snippets/namespace.md" >}}
     rules:
       - matches:
           - path:
               type: PathPrefix
               value: /mcp-github
         filters:
           - type: CORS
             cors:
               allowHeaders:
                 - "*"               
               allowMethods:            
                 - "*"              
               allowOrigins:
                 - "http://localhost:8080"
           - type: RequestHeaderModifier
             requestHeaderModifier:
               set: 
                 - name: Authorization
                   value: "Bearer ${GH_PAT}"
         backendRefs:
         - name: github-mcp-backend
           group: agentgateway.dev
           kind: {{< reuse "agw-docs/snippets/backend.md" >}}
   EOF
   ```
   
   

   
## Verify the connection {#verify}

Use the [MCP Inspector tool](https://modelcontextprotocol.io/legacy/tools/inspector) to verify that you can connect to your sample MCP server through agentgateway.

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
   kubectl port-forward deployment/agentgateway-proxy 8080:80 -n {{< reuse "agw-docs/snippets/namespace.md" >}}
   ```
   {{% /tab %}}
   {{< /tabs >}}

2. From your terminal, run the MCP Inspector command to open the MCP Inspector in your browser. If the MCP inspector tool does not open automatically, run `mcp-inspector`.
   ```sh
   npx modelcontextprotocol/inspector#{{% reuse "agw-docs/versions/mcp-inspector.md" %}}
   ```
   
3. From the MCP Inspector menu, connect to your agentgateway address as follows:
   * **Transport Type**: Select `Streamable HTTP`.
   * **URL**: Enter the agentgateway address, port, and the `/mcp-github` path. If your agentgateway proxy is exposed with a LoadBalancer server, use `http://<lb-address>/mcp-github`. In local test setups where you port-forwarded the agentgateway proxy on your local machine, use `http://localhost:8080/mcp-github`.
   * Click **Connect**.

4. From the menu bar, click the **Tools** tab. Then from the **Tools** pane, click **List Tools** and select the `get_me` tool. 
5. Click **Run Tool**.
6. Verify that you get back information about your username.

   {{< reuse-image src="img/mcp-inspector-gh.png" >}}
   {{< reuse-image-dark srcDark="img/mcp-inspector-gh-dark.png" >}}

## Cleanup

{{< reuse "agw-docs/snippets/cleanup.md" >}}

```sh
kubectl delete {{< reuse "agw-docs/snippets/backend.md" >}} github-mcp-backend -n {{< reuse "agw-docs/snippets/namespace.md" >}}
kubectl delete HTTPRoute mcp-github -n {{< reuse "agw-docs/snippets/namespace.md" >}} 

```
