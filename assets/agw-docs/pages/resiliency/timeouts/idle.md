You can customize an idle timeout for a connection to a downstream or upstream service if there are no active streams.

## About idle timeouts

The idle timeout applies when there is no activity on the connection, no bytes sent or received. It does not limit how long a single request or response can take. For example, calling httpbin’s `/delay/10` keeps a request in flight for 10 seconds, so the connection is not idle and you will get a normal 200 response after 10 seconds. To limit how long a request can run, use a [request timeout]({{< ref "request.md" >}}) for this scenario instead.

{{< callout type="info" >}}
The idle timeout is configured for entire HTTP/1 connections from a downstream service to the gateway proxy, and to the upstream service. 
{{< /callout >}}


{{< reuse "agw-docs/snippets/agentgateway/prereq.md" >}}

## Set up idle timeouts

1. Create an HTTPRoute for the `/headers` route.

   ```yaml
   kubectl apply -n httpbin -f- <<EOF
   apiVersion: gateway.networking.k8s.io/v1
   kind: HTTPRoute
   metadata:
     name: idle-timeout
     namespace: httpbin
   spec:
     hostnames:
     - idle.example
     parentRefs:
     - name: agentgateway-proxy
       namespace: {{< reuse "agw-docs/snippets/namespace.md" >}}
     rules:
     - matches: 
       - path:
           type: PathPrefix
           value: /headers
       backendRefs:
       - kind: Service
         name: httpbin
         port: 8000
       name: timeout
   EOF
   ```

1. Create an AgentgatewayPolicy with the idle timeout configuration. In this example, you apply an idle timeout of 1 second, which is short for testing purposes. You might choose to use 20-30 seconds as a more realistic timeout.

   ```yaml
   kubectl apply -f- <<EOF
   apiVersion: agentgateway.dev/v1alpha1
   kind: AgentgatewayPolicy
   metadata:
     name: idle-time
     namespace: {{< reuse "agw-docs/snippets/namespace.md" >}}
   spec:
     targetRefs:
       - kind: Gateway
         name: agentgateway-proxy
         group: gateway.networking.k8s.io
     frontend:
       http:
         http1IdleTimeout: 1s
   EOF
   ```

2. Verify that the gateway proxy is configured with the idle timeout.
   1. Port-forward the gateway proxy on port 15000.

      ```sh
      kubectl port-forward deployment/http -n {{< reuse "agw-docs/snippets/namespace.md" >}} 15000
      ```

   2. Get the config dump and verify that the idle timeout policy is set as you configured it.
      
      Example `jq` command:
      ```sh
      curl -s http://localhost:15000/config_dump | jq '[.policies[] | select(.policy.frontend != null and .policy.frontend.hTTP != null and .policy.frontend.hTTP.http1IdleTimeout != null)] | .[0]'
      ```
      
      Example output: 
      ```json {linenos=table,hl_lines=[20],filename="http://localhost:15000/config_dump"}
      {
        "key": "frontend/agentgateway-system/idle-time:frontend-http:agentgateway-system/agentgateway-proxy",
        "name": {
          "kind": "AgentgatewayPolicy",
          "name": "idle-time",
          "namespace": "agentgateway-system"
        },
        "target": {
          "gateway": {
            "gatewayName": "agentgateway-proxy",
            "gatewayNamespace": "agentgateway-system",
            "listenerName": null
          }
        },
        "policy": {
          "frontend": {
            "hTTP": {
              "maxBufferSize": 2097152,
              "http1MaxHeaders": null,
              "http1IdleTimeout": "1s",
              "http2WindowSize": null,
              "http2ConnectionWindowSize": null,
              "http2FrameSize": null,
              "http2KeepaliveInterval": null,
              "http2KeepaliveTimeout": null
            }
          }
        }
      }

      ```

3. Verify the idle timeout. Using `pycurl`, you can run this example script to show two connections. One connection is made normally, but the other connection is made with `CONNECT_ONLY`, sleeps, then sends the HTTP request over the same connection to simulate an idle connection. After the sleep, the proxy's idle timeout has closed the connection, so sending or receiving fails. This method works on Unix-like systems, such as Linux or macOS, where the active socket is a file descriptor.

   Install `pycurl`: 
   ```sh
   pip install pycurl
   ```
   
   Save and run the following Python script:
   <!-- How do you attribute AI examples? I used the Auto setting in Cursor, so it doesn't provide the model name. -->

   ```python
   #!/usr/bin/env python3
   """Demonstrate idle timeout: one run where it fires (idle too long), one where it does not."""
   import pycurl
   import socket
   import time

   URL = "http://localhost:8080/headers"
   HEADERS = ["Host: idle.example"]
   IDLE_TIMEOUT_SEC = 1  # match proxy config

   # ACTIVESOCKET in newer pycurl/libcurl; LASTSOCKET in older (deprecated but common)
   sock_info = getattr(pycurl, "ACTIVESOCKET", getattr(pycurl, "LASTSOCKET", None))
   if sock_info is None:
       raise RuntimeError("pycurl has no ACTIVESOCKET or LASTSOCKET; upgrade pycurl/libcurl")


   def connect_idle_then_send(sleep_sec: float) -> bool:
       """Connect with CONNECT_ONLY, sleep, then send request. Returns True if request succeeded."""
       c = pycurl.Curl()
       c.setopt(pycurl.URL, URL)
       c.setopt(pycurl.HTTPHEADER, HEADERS)
       c.setopt(pycurl.CONNECT_ONLY, 1)
       c.perform()

       time.sleep(sleep_sec)

       fd = c.getinfo(sock_info)
       if fd == -1:
           c.close()
           return False
       s = socket.socket(fileno=fd)
       try:
           s.sendall(b"GET /headers HTTP/1.1\r\nHost: idle.example\r\n\r\n")
           data = s.recv(4096).decode()
           # Check we got an HTTP response (e.g. 200)
           if data.strip().startswith("HTTP/"):
               return True
           return False
       except (BrokenPipeError, ConnectionResetError, OSError):
           return False
       finally:
           c.close()


   def normal_request() -> bool:
       """Do a normal GET (connect + request + response in one go). No idle period."""
       c = pycurl.Curl()
       c.setopt(pycurl.URL, URL)
       c.setopt(pycurl.HTTPHEADER, HEADERS)
       c.setopt(pycurl.WRITEFUNCTION, lambda _: None)  # discard body
       try:
           c.perform()
           code = c.getinfo(pycurl.RESPONSE_CODE)
           c.close()
           return 200 <= code < 400
       except pycurl.error:
           c.close()
           return False

   def main():
       # Scenario 1: idle LONGER than timeout -> connection closed, send fails
       print("=== 1. Idle timeout HIT (sleep > 1s) ===")
       print("Connect, then wait 2s with no data (proxy closes connection after 1s)...")
       ok = connect_idle_then_send(2.0)
       if ok:
           print("Unexpected: request succeeded (idle timeout may not be 1s or proxy didn't close).\n")
       else:
           print("Result: connection was closed by proxy (idle timeout worked).\n")
       # Scenario 2: normal request (no idle period) -> succeeds
       # No CONNECT_ONLY; we send the request immediately as part of perform().
       print("=== 2. Idle timeout NOT hit (normal request) ===")
       print("Send a normal GET (connect + request in one step; connection never idle)...")
       ok = normal_request()
       if ok:
           print("Result: request succeeded (connection was still open).\n")
       else:
           print("Unexpected: request failed (check URL and proxy).\n")


   if __name__ == "__main__":
       main()
   ```
   Expected output: 
   
   ```txt
   === 1. Idle timeout HIT (sleep > 1s) ===
   Connect, then wait 2s with no data (proxy closes connection after 1s)...
   Result: connection was closed by proxy (idle timeout worked).
 
   === 2. Idle timeout NOT hit (normal request) ===
   Send a normal GET (connect + request in one step; connection never idle)...
   Result: request succeeded (connection was still open).

   ```
      
## Cleanup

{{< reuse "agw-docs/snippets/cleanup.md" >}} Run the following commands.
   
```sh
kubectl delete httproute idle-timeout -n httpbin
kubectl delete AgentgatewayPolicy idle-time -n {{< reuse "agw-docs/snippets/namespace.md" >}} 
```


