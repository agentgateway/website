---
title: Setup
weight: 21
icon: cloud_upload
description: Install agentgateway, set up the admin UI and configuration storage, and update your configuration.
test: skip
aliases:
  - /docs/standalone/main/deployment/
---

Install agentgateway in your environment, then set up the parts that every installation needs: the admin UI, where agentgateway stores the configuration that you manage in that UI, and how you change that configuration later.

{{< cards >}}
  {{< card link="install/" title="Install" description="Install agentgateway as a binary, a Docker container, or a Kubernetes Deployment with Helm." >}}
  {{< card link="ui/" title="Admin UI" description="Open, expose, and secure the built-in admin UI." >}}
  {{< card link="storage/" title="Configuration storage" description="Choose whether agentgateway stores UI-managed configuration in your config file or in a database." >}}
  {{< card link="update/" title="Update your configuration" description="Change your agentgateway configuration in each installation method." >}}
{{< /cards >}}
