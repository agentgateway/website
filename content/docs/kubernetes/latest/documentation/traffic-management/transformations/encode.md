---
title: Encode base64 headers
weight: 20
description: Automatically encode and decode base64 values in request headers.
test:
  encode:
    type: functional
    steps:
    - file: ${versionRoot}/documentation/quickstart/install.md
      path: experimental
    - file: ${versionRoot}/documentation/setup/gateway.md
      path: all
    - file: ${versionRoot}/documentation/install/sample-app.md
      path: install-httpbin
    - file: ${versionRoot}/documentation/traffic-management/transformations/encode.md
      path: encode
      assert:
      - products/agentgateway/main/traffic-management/transformations/encode.sh
  decode:
    type: functional
    steps:
    - file: ${versionRoot}/documentation/quickstart/install.md
      path: experimental
    - file: ${versionRoot}/documentation/setup/gateway.md
      path: all
    - file: ${versionRoot}/documentation/install/sample-app.md
      path: install-httpbin
    - file: ${versionRoot}/documentation/traffic-management/transformations/encode.md
      path: decode
      assert:
      - products/agentgateway/main/traffic-management/transformations/decode.sh
  encode-schema:
    type: schema
    steps:
    - file: ${versionRoot}/documentation/traffic-management/transformations/encode.md
      path: encode
  decode-schema:
    type: schema
    steps:
    - file: ${versionRoot}/documentation/traffic-management/transformations/encode.md
      path: decode
---
{{< reuse "agw-docs/pages/traffic-management/transformations/encode.md" >}}
