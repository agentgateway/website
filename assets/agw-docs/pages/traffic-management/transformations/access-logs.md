When building or debugging transformations, you can log CEL variables to inspect what values are available at runtime. Each entry maps a log field name to a CEL expression that is evaluated per request and written to the structured access log. The examples use the `variables()` function to dump the full context, or individual variables such as `request.path`, `request.method`, and `source.address`.


{{< reuse "agw-docs/snippets/agentgateway/prereq.md" >}}

## Log CEL variables

1. Create a `values.yaml` file with your logging configuration under `agentgateway.config.logging.fields.add`. Choose one of the following options:

   * **Log all variables**: Use the `variables()` function to dump the full CEL context as a JSON object. This is useful when you are unsure which variables are available.

     ```yaml
     # values.yaml
     agentgateway:
       config:
         logging:
           fields:
             add:
               cel: variables()
       enabled: true
     ```

   * **Log specific variables**: Map individual field names to CEL expressions to keep logs concise. The field names on the left (`request_path`, `request_method`, `client_ip`) are arbitrary and become the keys in the structured log output.

     ```yaml
     # values.yaml
     agentgateway:
       config:
         logging:
           fields:
             add:
               request_path: request.path
               request_method: request.method
               client_ip: source.address
       enabled: true
     ```

2. Apply the configuration with `helm upgrade`:

   ```sh
   helm upgrade -i -n agentgateway-system agentgateway \
     oci://cr.agentgateway.dev/charts/agentgateway \
     -f values.yaml
   ```

3. Send a request through the gateway.

   {{< tabs items="Cloud Provider LoadBalancer,Port-forward for local testing" tabTotal="2" >}}
   {{% tab tabName="Cloud Provider LoadBalancer" %}}
   ```sh
   curl -vi http://$INGRESS_GW_ADDRESS:80/get \
    -H "host: www.example.com:80"
   ```
   {{% /tab %}}
   {{% tab tabName="Port-forward for local testing" %}}
   ```sh
   curl -vi localhost:8080/get \
   -H "host: www.example.com"
   ```
   {{% /tab %}}
   {{< /tabs >}}

4. Check the agentgateway logs to verify that the CEL variables are being logged.

   ```sh
   kubectl logs -n agentgateway-system -l app.kubernetes.io/name=agentgateway | grep cel
   ```

   Example output:

   ```json
   {
     "cel": {
       "request.path": "/get",
       "request.method": "GET",
       "request.scheme": "http",
       "request.host": "www.example.com",
       "source.address": "10.244.0.6"
     }
   }
   ```
