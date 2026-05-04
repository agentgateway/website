You can use this guide to upgrade the {{< reuse "/agw-docs/snippets/kgateway.md" >}} control plane and data plane components, or to apply changes to the components' configuration settings.

## Before you begin

Review the [release notes]({{< link-hextra path="/reference/release-notes/" >}}) for any breaking changes or new configuration that you want to use.

## Upgrade {#upgrade-steps}

1. Set the version you want to upgrade to in an environment variable, such as the latest patch version (`{{< reuse "agw-docs/versions/n-patch.md" >}}`) .
   
   ```sh {paths="upgrade"}
   export NEW_VERSION={{< reuse "agw-docs/versions/n-patch.md" >}}
   ```

2. **Optional**: To check the new CRDs locally, download the CRDs to a `helm` directory.

   ```sh
   helm template --version {{< reuse "agw-docs/versions/helm-version-upgrade.md" >}} {{< reuse "/agw-docs/snippets/helm-kgateway-crds.md" >}} {{< reuse "/agw-docs/snippets/helm-path-crds.md" >}}  --output-dir ./helm
   ```

3. Upgrade the CRDs in your cluster.
   
   ```sh {paths="upgrade"}
   helm upgrade -i --namespace {{< reuse "agw-docs/snippets/namespace.md" >}} --version {{< reuse "agw-docs/versions/helm-version-upgrade.md" >}} {{< reuse "/agw-docs/snippets/helm-kgateway-crds.md" >}} {{< reuse "/agw-docs/snippets/helm-path-crds.md" >}}
   ```

{{< doc-test paths="upgrade" >}}
helm get values {{< reuse "/agw-docs/snippets/helm-kgateway.md" >}} -n {{< reuse "agw-docs/snippets/namespace.md" >}} -o yaml > values.yaml
{{< /doc-test >}}

4. Get the Helm values file for your current version.
      
   ```sh
   helm get values {{< reuse "/agw-docs/snippets/helm-kgateway.md" >}} -n {{< reuse "agw-docs/snippets/namespace.md" >}} -o yaml > values.yaml
   open values.yaml
   ```

5. Compare your current Helm chart values with the version that you want to upgrade to. 
   
   * **Show all values**: 
      
     ```sh
     helm show values {{< reuse "/agw-docs/snippets/helm-path.md" >}} --version {{< reuse "agw-docs/versions/helm-version-upgrade.md" >}}
     ```

   * **Get a file with all values**: You can get a `{{< reuse "/agw-docs/snippets/helm-kgateway.md" >}}/values.yaml` file for the upgrade version by pulling and inspecting the Helm chart locally.
      
     ```sh
     helm pull {{< reuse "/agw-docs/snippets/helm-path.md" >}} --version {{< reuse "agw-docs/versions/helm-version-upgrade.md" >}}
     tar -xvf {{< reuse "/agw-docs/snippets/helm-kgateway.md" >}}-{{< reuse "agw-docs/versions/helm-version-upgrade.md" >}}.tgz
     open {{< reuse "/agw-docs/snippets/helm-kgateway.md" >}}/values.yaml
     ```

6. Make any changes that you want by editing your `values.yaml` Helm values file or preparing the `--set` flags. For development {{< reuse "agw-docs/versions/patch-dev.md" >}} builds, include the `controller.image.pullPolicy=Always` setting or refer to the exact image digest to avoid using cached images.

7. Upgrade the {{< reuse "agw-docs/snippets/kgateway.md" >}} control plane Helm installation.
   * Make sure to include your Helm values when you upgrade either as a configuration file or with `--set` flags. Otherwise, any previous custom values that you set might be overwritten.
   * When using the development build {{< reuse "agw-docs/versions/patch-dev.md" >}}, add the `--set controller.image.pullPolicy=Always` option to ensure you get the latest image. Alternatively, you can specify the exact image digest.
   * To use experimental Gateway API features, include the experimental feature gate, `--set controller.extraEnv.KGW_ENABLE_GATEWAY_API_EXPERIMENTAL_FEATURES=true`.
   
   ```sh {paths="upgrade"}
   helm upgrade -i -n {{< reuse "agw-docs/snippets/namespace.md" >}} {{< reuse "/agw-docs/snippets/helm-kgateway.md" >}} {{< reuse "/agw-docs/snippets/helm-path.md" >}} \
     -f values.yaml \
     --version {{< reuse "agw-docs/versions/helm-version-upgrade.md" >}} 
   ```

{{< doc-test paths="upgrade" >}}
YAMLTest -f - <<'EOF'
- name: wait for control plane pod to be ready after upgrade
  wait:
    target:
      kind: Deployment
      metadata:
        namespace: agentgateway-system
        name: agentgateway
    jsonPath: "$.status.availableReplicas"
    jsonPathExpectation:
      comparator: greaterThan
      value: 0
    polling:
      timeoutSeconds: 120
      intervalSeconds: 5
EOF
{{< /doc-test >}}

## Verify the upgrade {#verify}

1. Verify that the control plane runs the upgraded version.
   
   ```sh {paths="upgrade"}
   kubectl -n {{< reuse "agw-docs/snippets/namespace.md" >}} get pod -l app.kubernetes.io/name={{< reuse "/agw-docs/snippets/helm-kgateway.md" >}} -o jsonpath='{.items[0].spec.containers[0].image}'
   ```
   
   Example output:
   ```
   cr.{{< reuse "agw-docs/snippets/kgateway.md" >}}.dev/controller:{{< reuse "agw-docs/versions/n-patch.md" >}}
   ```

2. Confirm that the control plane is up and running. 
   
   ```sh {paths="upgrade"}
   kubectl get pods -n {{< reuse "agw-docs/snippets/namespace.md" >}}
   ```
