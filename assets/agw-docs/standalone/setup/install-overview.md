Agentgateway runs the same proxy and reads the same configuration file in every installation method. What differs is who starts the process, where the configuration file lives, and whether that file is writable.

## Choose an installation method

Review the following table to choose the method that fits your environment.

| Method | Use it when | Configuration file |
| --- | --- | --- |
| [Binary]({{< link-hextra path="/setup/install/binary/" >}}) | You want to run agentgateway on a laptop or a virtual machine, or you are trying agentgateway for the first time. | A local file that you pass with `-f`, or one that agentgateway generates in your user config directory. Writable. |
| [Docker]({{< link-hextra path="/setup/install/docker/" >}}) | You want a container without a Kubernetes cluster, such as in Docker Compose or on a container host. | A file or directory that you mount into the container. Writable, unless you mount it read-only. |
| [Helm]({{< link-hextra path="/setup/install/helm/" >}}) | You want Kubernetes to run and expose the proxy for you, but you do not want a control plane. | A ConfigMap that Helm renders from your values and mounts read-only. |

All three methods run agentgateway in standalone mode, where your configuration file is the source of truth. If you want a managed Kubernetes deployment with a control plane, Gateway API support, and dynamic Kubernetes resources instead, see [Kubernetes control plane]({{< link-hextra path="/setup/install/kubernetes/" >}}).

## After you install

Whichever method you choose, the same three setup topics apply:

* [Admin UI]({{< link-hextra path="/setup/ui/" >}}) to open, expose, and secure the built-in web interface.
* [Configuration storage]({{< link-hextra path="/setup/storage/" >}}) to choose whether the UI writes to your configuration file, to a database, or not at all.
* [Update your configuration]({{< link-hextra path="/setup/update/" >}}) to change your configuration after agentgateway is running.
