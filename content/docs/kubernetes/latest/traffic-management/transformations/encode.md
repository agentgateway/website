---
title: Encode base64 headers
weight: 20
description: Automatically encode and decode base64 values in request headers.
test:
  encode:
    type: functional
    steps:
    - file: ${versionRoot}/quickstart/install.md
      path: experimental
    - file: ${versionRoot}/setup/gateway.md
      path: all
    - file: ${versionRoot}/install/sample-app.md
      path: install-httpbin
    - file: ${versionRoot}/traffic-management/transformations/encode.md
      path: encode
      assert:
      - products/agentgateway/main/traffic-management/transformations/encode.sh
  encode-schema:
    type: schema
    steps:
    - file: ${versionRoot}/traffic-management/transformations/encode.md
      path: encode
  decode:
    type: functional
    steps:
    - file: ${versionRoot}/quickstart/install.md
      path: experimental
    - file: ${versionRoot}/setup/gateway.md
      path: all
    - file: ${versionRoot}/install/sample-app.md
      path: install-httpbin
    - file: ${versionRoot}/traffic-management/transformations/encode.md
      path: decode
      assert:
      - products/agentgateway/main/traffic-management/transformations/decode.sh
  decode-schema:
    type: schema
    steps:
    - file: ${versionRoot}/traffic-management/transformations/encode.md
      path: decode
---
{{< reuse "agw-docs/pages/traffic-management/transformations/encode.md" >}}
