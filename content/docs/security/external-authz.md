---
title: External authorization
weight: 10
---

For cases where authorization decisions need to be made out-of-process, the external authorization policy can be used.
This sends a request to an external server, such as [Open Policy Agent](https://www.openpolicyagent.org/docs/envoy) which will decide whether the request is allowed or denied.
This is done utilizing the [External Authorization gRPC service](https://www.envoyproxy.io/docs/envoy/latest/api-v3/service/auth/v3/external_auth.proto).

Configuration just requires specifying the address of the authorization service:

```yaml
extAuthz:
  host: localhost:9000
```
