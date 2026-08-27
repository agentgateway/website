---
title: AWS backend authentication
weight: 10
description: Sign requests to an AWS service with AWS Signature Version 4, optionally through an assumed IAM role.
test:
  backend-authn-aws:
  - file: ${versionRoot}/configuration/security/backend-authn/providers/aws.md
    path: backend-authn-aws
---

Attaches to: {{< badge content="Backend" path="/configuration/backends/" >}}

{{< reuse "agw-docs/pages/security/backend-authn-aws-standalone.md" >}}
