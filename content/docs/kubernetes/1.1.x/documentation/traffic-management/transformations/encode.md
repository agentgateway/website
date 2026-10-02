---
title: Encode base64 headers
weight: 20
description: Automatically encode and decode base64 values in request headers.
test:
  encode:
    type: functional
    steps:
    - file: content/docs/kubernetes/latest/documentation/quickstart/install.md
      path: experimental
    - file: content/docs/kubernetes/latest/documentation/setup/gateway.md
      path: all
    - file: content/docs/kubernetes/latest/documentation/install/sample-app.md
      path: install-httpbin
    - file: content/docs/kubernetes/latest/documentation/traffic-management/transformations/encode.md
      path: encode
      assert:
      - products/agentgateway/main/traffic-management/transformations/encode.sh
  decode:
    type: functional
    steps:
    - file: content/docs/kubernetes/latest/documentation/quickstart/install.md
      path: experimental
    - file: content/docs/kubernetes/latest/documentation/setup/gateway.md
      path: all
    - file: content/docs/kubernetes/latest/documentation/install/sample-app.md
      path: install-httpbin
    - file: content/docs/kubernetes/latest/documentation/traffic-management/transformations/encode.md
      path: decode
      assert:
      - products/agentgateway/main/traffic-management/transformations/decode.sh
---
{{< reuse "agw-docs/pages/traffic-management/transformations/encode.md" >}}
