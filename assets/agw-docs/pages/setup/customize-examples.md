Review common proxy customizations that you might want to apply in your environment. For steps on how to apply these configurations, see [Customize the gateway]({{< link-hextra path="/setup/customize/" >}}).

## Built-in customization

Use built-in customization options automatically validate your changes when you create the agentgateway proxy in your cluster.

To learn more, see [Built-in customization]({{< link-hextra path="/setup/customize/options/#built-in" >}}). 

### Add environment variables {#env-vars}

Add custom environment variables to the agentgateway container. To set a default environment variable to an empty value, set `value: ""`  as shown for the `RUST_BACKTRACE` environment variable. 

```yaml
kubectl apply --server-side -f- <<'EOF'
apiVersion: {{< reuse "agw-docs/snippets/gatewayparam-apiversion.md" >}}
kind: {{< reuse "agw-docs/snippets/gatewayparameters.md" >}}
metadata:
  name: agentgateway-config
  namespace: {{< reuse "agw-docs/snippets/namespace.md" >}}
spec:
  env:
    - name: MY_CUSTOM_VAR
      value: "my-value"
    - name: CONNECTION_MIN_TERMINATION_DEADLINE
      value: "500s"
    # Set a default env variable to null
    - name: RUST_BACKTRACE
      value: ""
EOF
```

### Custom image {#custom-image}

Use the `image` config to specify a custom container image. This is a config, not an overlay, so it is validated at apply time.

```yaml
kubectl apply --server-side -f- <<'EOF'
apiVersion: {{< reuse "agw-docs/snippets/gatewayparam-apiversion.md" >}}
kind: {{< reuse "agw-docs/snippets/gatewayparameters.md" >}}
metadata:
  name: agentgateway-config
  namespace: {{< reuse "agw-docs/snippets/namespace.md" >}}
spec:
  image:
    registry: my-registry.io
    repository: my-org/agentgateway
    tag: v2.0.0
    pullPolicy: Always
EOF
```

You can also pin to a specific digest for immutable deployments:

```yaml
spec:
  image:
    registry: my-registry.io
    repository: my-org/agentgateway
    digest: sha256:abcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890
```

### Change logging format

Change the logging format from `text` to `json`. 
```yaml
kubectl apply --server-side -f- <<'EOF'
apiVersion: {{< reuse "agw-docs/snippets/gatewayparam-apiversion.md" >}}
kind: {{< reuse "agw-docs/snippets/gatewayparameters.md" >}}
metadata:
  name: agentgateway-config
  namespace: {{< reuse "agw-docs/snippets/namespace.md" >}}
spec:
  logging:
    format: json
EOF
```

### Resource requests and limits {#resources-limits-requests}

Configure CPU and memory requests and limits for the agentgateway container.

```yaml
kubectl apply --server-side -f- <<'EOF'
apiVersion: {{< reuse "agw-docs/snippets/gatewayparam-apiversion.md" >}}
kind: {{< reuse "agw-docs/snippets/gatewayparameters.md" >}}
metadata:
  name: agentgateway-config
  namespace: {{< reuse "agw-docs/snippets/namespace.md" >}}
spec:
  resources:
    requests:
      cpu: 100m
      memory: 128Mi
    limits:
      cpu: 500m
      memory: 512Mi
EOF
```

## Overlays

To learn more about overlays, see [Overlays]({{< link-hextra path="/setup/customize/options/#overlays" >}}).

### Change deployment replicas {#deployment-replicas}

Set a specific number of replicas for the agentgateway deployment.

```yaml
kubectl apply --server-side -f- <<'EOF'
apiVersion: {{< reuse "agw-docs/snippets/gatewayparam-apiversion.md" >}}
kind: {{< reuse "agw-docs/snippets/gatewayparameters.md" >}}
metadata:
  name: agentgateway-config
  namespace: {{< reuse "agw-docs/snippets/namespace.md" >}}
spec:
  deployment:
    spec:
      replicas: 3
EOF
```

### Image pull secrets {#image-pull-secrets}

Add image pull secrets to pull container images from private registries.

```yaml
kubectl apply --server-side -f- <<'EOF'
apiVersion: {{< reuse "agw-docs/snippets/gatewayparam-apiversion.md" >}}
kind: {{< reuse "agw-docs/snippets/gatewayparameters.md" >}}
metadata:
  name: agentgateway-config
  namespace: {{< reuse "agw-docs/snippets/namespace.md" >}}
spec:
  deployment:
    spec:
      template:
        spec:
          imagePullSecrets:
            - name: my-registry-secret
EOF
```

### Remove security context for OpenShift {#ssc-openshift}

OpenShift manages security contexts through Security Context Constraints (SCCs). Remove the default security context to allow OpenShift to assign appropriate values. Use `$patch: delete` to remove security contexts, or set the field to `null` to set the security context to a null value. 

```yaml
kubectl apply --server-side -f- <<'EOF'
apiVersion: {{< reuse "agw-docs/snippets/gatewayparam-apiversion.md" >}}
kind: {{< reuse "agw-docs/snippets/gatewayparameters.md" >}}
metadata:
  name: agentgateway-config
  namespace: {{< reuse "agw-docs/snippets/namespace.md" >}}
spec:
  deployment:
    spec:
      template:
        spec:
          # Delete pod-level securityContext using $patch: delete (works with any apply mode)
          securityContext:
            $patch: delete
          containers:
            - name: agentgateway
              # Delete container-level securityContext using null (requires server-side apply)
              securityContext: null
EOF
```

### Custom pod security context {#security-context}

Configure custom security settings for the pod and containers.

```yaml
kubectl apply --server-side -f- <<'EOF'
apiVersion: {{< reuse "agw-docs/snippets/gatewayparam-apiversion.md" >}}
kind: {{< reuse "agw-docs/snippets/gatewayparameters.md" >}}
metadata:
  name: agentgateway-config
  namespace: {{< reuse "agw-docs/snippets/namespace.md" >}}
spec:
  deployment:
    spec:
      template:
        spec:
          securityContext:
            runAsUser: 1000
            runAsGroup: 2000
            fsGroup: 3000
EOF
```

### Pod and node affiinity {#pod-scheduling}

Configure node selectors, affinities, tolerations, and topology spread constraints to control where agentgateway proxy pods are scheduled.

```yaml
kubectl apply --server-side -f- <<'EOF'
apiVersion: {{< reuse "agw-docs/snippets/gatewayparam-apiversion.md" >}}
kind: {{< reuse "agw-docs/snippets/gatewayparameters.md" >}}
metadata:
  name: agentgateway-config
  namespace: {{< reuse "agw-docs/snippets/namespace.md" >}}
spec:
  deployment:
    spec:
      template:
        spec:
          nodeSelector:
            node-type: agent
            zone: us-west-1a
          affinity:
            nodeAffinity:
              requiredDuringSchedulingIgnoredDuringExecution:
                nodeSelectorTerms:
                  - matchExpressions:
                      - key: kubernetes.io/arch
                        operator: In
                        values:
                          - amd64
                          - arm64
          tolerations:
            - key: dedicated
              operator: Equal
              value: agent-gateway
              effect: NoSchedule
          topologySpreadConstraints:
            - maxSkew: 1
              topologyKey: kubernetes.io/hostname
              whenUnsatisfiable: DoNotSchedule
              labelSelector:
                matchLabels:
                  app: agentgateway
EOF
```

### HorizontalPodAutoscaler (HPA) {#hpa}

Configure automatic scaling based on CPU utilization. The HPA resource is created only when you specify this overlay.

```yaml
kubectl apply --server-side -f- <<'EOF'
apiVersion: {{< reuse "agw-docs/snippets/gatewayparam-apiversion.md" >}}
kind: {{< reuse "agw-docs/snippets/gatewayparameters.md" >}}
metadata:
  name: agentgateway-config
  namespace: {{< reuse "agw-docs/snippets/namespace.md" >}}
spec:
  horizontalPodAutoscaler:
    metadata:
      labels:
        app.kubernetes.io/name: agentgateway-config
    spec:
      minReplicas: 2
      maxReplicas: 10
      metrics:
        - type: Resource
          resource:
            name: cpu
            target:
              type: Utilization
              averageUtilization: 80
EOF
```

### PodDisruptionBudget (PDB) {#pdb}

Configure a Pod Disruption Budget to ensure that at least one instance of your agentgateway proxy is up an running at any given time during voluntary disruptions, such as upgrades. The PDB resource is only created when you specify this overlay.

```yaml
kubectl apply --server-side -f- <<'EOF'
apiVersion: {{< reuse "agw-docs/snippets/gatewayparam-apiversion.md" >}}
kind: {{< reuse "agw-docs/snippets/gatewayparameters.md" >}}
metadata:
  name: agentgateway-config
  namespace: {{< reuse "agw-docs/snippets/namespace.md" >}}
spec:
  podDisruptionBudget:
    metadata:
      labels:
        app.kubernetes.io/name: agentgateway-config
    spec:
      minAvailable: 1
EOF
```

### Custom ConfigMap as volume {#configmap-volume}

Mount a custom ConfigMap to the `agentgateway` container that runs inside your agentgateway proxy pod. This example replaces the default volumes with a custom config.

```yaml
kubectl apply --server-side -f- <<'EOF'
apiVersion: {{< reuse "agw-docs/snippets/gatewayparam-apiversion.md" >}}
kind: {{< reuse "agw-docs/snippets/gatewayparameters.md" >}}
metadata:
  name: agentgateway-config
  namespace: {{< reuse "agw-docs/snippets/namespace.md" >}}
spec:
  deployment:
    spec:
      template:
        spec:
          volumes:
            - name: custom-config
              configMap:
                name: my-custom-config
          containers:
            - name: agentgateway
              volumeMounts:
                - name: custom-config
                  mountPath: /etc/custom-config
                  readOnly: true
EOF
```

### Replace all volumes {#recipe-replace-volumes}

Use `$patch: replace` to completely replace a list of volumes instead of merging. Note that the `$patch` directive must be on its own list item.

```yaml
kubectl apply --server-side -f- <<'EOF'
apiVersion: {{< reuse "agw-docs/snippets/gatewayparam-apiversion.md" >}}
kind: {{< reuse "agw-docs/snippets/gatewayparameters.md" >}}
metadata:
  name: agentgateway-config
  namespace: {{< reuse "agw-docs/snippets/namespace.md" >}}
spec:
  deployment:
    spec:
      template:
        spec:
          volumes:
            - $patch: replace
            - name: custom-config
              configMap:
                name: my-custom-config
EOF
```

{{< callout type="warning" >}}
**Important:** Place `$patch: replace` as a separate list item before your actual items. If you include it in the same item as your config, you might end up with an empty list.
{{< /callout >}}


### Custom labels and annotations {#labels-annotations}

Add custom labels and annotations to deployments, pods, and services.

```yaml
kubectl apply --server-side -f- <<'EOF'
apiVersion: {{< reuse "agw-docs/snippets/gatewayparam-apiversion.md" >}}
kind: {{< reuse "agw-docs/snippets/gatewayparameters.md" >}}
metadata:
  name: agentgateway-config
  namespace: {{< reuse "agw-docs/snippets/namespace.md" >}}
spec:
  deployment:
    metadata:
      labels:
        environment: production
        team: platform
      annotations:
        description: "Production agentgateway proxy"
    spec:
      template:
        metadata:
          labels:
            environment: production
          annotations:
            prometheus.io/scrape: "true"
            prometheus.io/port: "15020"
  service:
    metadata:
      annotations:
        service.beta.kubernetes.io/aws-load-balancer-type: "nlb"
EOF
```

<!--

### Remove label with null {#recipe-remove-label}

Remove a default label by setting it to `null`. Use `kubectl apply --server-side` to apply the change.

```yaml
kubectl apply --server-side -f- <<'EOF'
apiVersion: {{< reuse "agw-docs/snippets/gatewayparam-apiversion.md" >}}
kind: {{< reuse "agw-docs/snippets/gatewayparameters.md" >}}
metadata:
  name: agentgateway-config
  namespace: {{< reuse "agw-docs/snippets/namespace.md" >}}
spec:
  deployment:
    metadata:
      labels:
        # Remove the app.kubernetes.io/instance label
        app.kubernetes.io/instance: "null"
EOF
```
-->

### Custom service ports {#service-ports}

Replace the default service ports with custom port configurations.

```yaml
kubectl apply --server-side -f- <<'EOF'
apiVersion: {{< reuse "agw-docs/snippets/gatewayparam-apiversion.md" >}}
kind: {{< reuse "agw-docs/snippets/gatewayparameters.md" >}}
metadata:
  name: agentgateway-config
  namespace: {{< reuse "agw-docs/snippets/namespace.md" >}}
spec:
  service:
    spec:
      ports:
        - $patch: replace
        - name: http
          port: 80
          targetPort: 8080
          protocol: TCP
        - name: https
          port: 443
          targetPort: 8443
          protocol: TCP
EOF
```

### Shutdown configuration (config) {#shutdown}

Configure graceful shutdown timeouts using the `shutdown` config.

```yaml
kubectl apply --server-side -f- <<'EOF'
apiVersion: {{< reuse "agw-docs/snippets/gatewayparam-apiversion.md" >}}
kind: {{< reuse "agw-docs/snippets/gatewayparameters.md" >}}
metadata:
  name: agentgateway-config
  namespace: {{< reuse "agw-docs/snippets/namespace.md" >}}
spec:
  shutdown:
    min: 15
    max: 120
EOF
```

### Static IP for LoadBalancer {#static-ip}

Assign a static IP address to the LoadBalancer service.

```yaml
kubectl apply --server-side -f- <<'EOF'
apiVersion: {{< reuse "agw-docs/snippets/gatewayparam-apiversion.md" >}}
kind: {{< reuse "agw-docs/snippets/gatewayparameters.md" >}}
metadata:
  name: agentgateway-config
  namespace: {{< reuse "agw-docs/snippets/namespace.md" >}}
spec:
  service:
    spec:
      loadBalancerIP: 203.0.113.10
EOF
```

### GKE-specific service annotations {#gke-annotation}

Configure GKE-specific features like Regional Backend Services (RBS) and static IPs using service annotations.

```yaml
kubectl apply --server-side -f- <<'EOF'
apiVersion: {{< reuse "agw-docs/snippets/gatewayparam-apiversion.md" >}}
kind: {{< reuse "agw-docs/snippets/gatewayparameters.md" >}}
metadata:
  name: agentgateway-config
  namespace: {{< reuse "agw-docs/snippets/namespace.md" >}}
spec:
  service:
    metadata:
      annotations:
        # Enable Regional Backend Services for better load balancing
        cloud.google.com/l4-rbs: "enabled"
        # Use pre-reserved static IPs
        networking.gke.io/load-balancer-ip-addresses: "my-v4-ip,my-v6-ip"
        # Specify the subnet for internal load balancers
        networking.gke.io/load-balancer-subnet: "my-subnet"
EOF
```

### AWS EKS load balancer annotations {#aws-eks-annotation}

Configure AWS-specific load balancer features using service annotations.

```yaml
kubectl apply --server-side -f- <<'EOF'
apiVersion: {{< reuse "agw-docs/snippets/gatewayparam-apiversion.md" >}}
kind: {{< reuse "agw-docs/snippets/gatewayparameters.md" >}}
metadata:
  name: agentgateway-config
  namespace: {{< reuse "agw-docs/snippets/namespace.md" >}}
spec:
  service:
    metadata:
      annotations:
        # Use Network Load Balancer instead of Classic
        service.beta.kubernetes.io/aws-load-balancer-type: "nlb"
        # Make it internal (no public IP)
        service.beta.kubernetes.io/aws-load-balancer-internal: "true"
        # Enable cross-zone load balancing
        service.beta.kubernetes.io/aws-load-balancer-cross-zone-load-balancing-enabled: "true"
        # Specify subnets
        service.beta.kubernetes.io/aws-load-balancer-subnets: "subnet-abc123,subnet-def456"
EOF
```

### Azure AKS load balancer annotations {#azure-aks-annotation}

Configure Azure-specific load balancer features using service annotations.

```yaml
kubectl apply --server-side -f- <<'EOF'
apiVersion: {{< reuse "agw-docs/snippets/gatewayparam-apiversion.md" >}}
kind: {{< reuse "agw-docs/snippets/gatewayparameters.md" >}}
metadata:
  name: agentgateway-config
  namespace: {{< reuse "agw-docs/snippets/namespace.md" >}}
spec:
  service:
    metadata:
      annotations:
        # Make it internal
        service.beta.kubernetes.io/azure-load-balancer-internal: "true"
        # Specify resource group for the load balancer
        service.beta.kubernetes.io/azure-load-balancer-resource-group: "my-resource-group"
EOF
```


### Add init containers {#init-containers}

Add init containers that run before the main agentgateway container starts.

```yaml
kubectl apply --server-side -f- <<'EOF'
apiVersion: {{< reuse "agw-docs/snippets/gatewayparam-apiversion.md" >}}
kind: {{< reuse "agw-docs/snippets/gatewayparameters.md" >}}
metadata:
  name: agentgateway-config
  namespace: {{< reuse "agw-docs/snippets/namespace.md" >}}
spec:
  deployment:
    spec:
      template:
        spec:
          initContainers:
            - name: wait-for-config
              image: busybox:1.36
              command: ['sh', '-c', 'until [ -f /config/ready ]; do sleep 1; done']
              volumeMounts:
                - name: config-volume
                  mountPath: /config
EOF
```

### Add sidecar containers {#sidecar-container}

Add sidecar containers alongside the main agentgateway container.

```yaml
kubectl apply --server-side -f- <<'EOF'
apiVersion: {{< reuse "agw-docs/snippets/gatewayparam-apiversion.md" >}}
kind: {{< reuse "agw-docs/snippets/gatewayparameters.md" >}}
metadata:
  name: agentgateway-config
  namespace: {{< reuse "agw-docs/snippets/namespace.md" >}}
spec:
  deployment:
    spec:
      template:
        spec:
          containers:
            - name: agentgateway
              # This merges with the existing agentgateway container
            - name: log-shipper
              image: fluent/fluent-bit:latest
              volumeMounts:
                - name: logs
                  mountPath: /var/log/agentgateway
EOF
```

### ServiceAccount annotations for IAM {#sa-annotation}

Add annotations to the ServiceAccount for cloud provider IAM integration (e.g., AWS IRSA, GKE Workload Identity).

```yaml
kubectl apply --server-side -f- <<'EOF'
apiVersion: {{< reuse "agw-docs/snippets/gatewayparam-apiversion.md" >}}
kind: {{< reuse "agw-docs/snippets/gatewayparameters.md" >}}
metadata:
  name: agentgateway-config
  namespace: {{< reuse "agw-docs/snippets/namespace.md" >}}
spec:
  serviceAccount:
    metadata:
      annotations:
        # AWS IRSA
        eks.amazonaws.com/role-arn: "arn:aws:iam::123456789012:role/agentgateway-role"
        # Or GKE Workload Identity
        # iam.gke.io/gcp-service-account: "agentgateway@my-project.iam.gserviceaccount.com"
EOF
```
