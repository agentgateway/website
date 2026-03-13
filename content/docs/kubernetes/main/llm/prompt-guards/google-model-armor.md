---
title: Google Model Armor
weight: 30
description: Apply Google Cloud Model Armor templates to sanitize LLM requests and responses.
---

[Google Cloud Model Armor](https://cloud.google.com/security/products/model-armor) lets you create safety templates in the Google Cloud console and apply them to LLM traffic. Model Armor sanitizes both user prompts and model responses against your configured policies, blocking content that violates your templates.

Google Cloud Model Armor guardrails are model-agnostic and can be applied to any Large Language Model (LLM), whether it is hosted on AWS Bedrock, another cloud provider (like Google or Azure), or on-premises.

## Before you begin

1. {{< reuse "agw-docs/snippets/prereq-agentgateway.md" >}}
2. Set up access to the [Gemini LLM provider]({{< link-hextra path="/llm/providers/gemini/" >}}). 

## Set up the Google Model Armor

1. Log in to the Google Cloud console and create a [Model Armor template](https://console.cloud.google.com/security/model-armor). For more information, see the [Google Cloud documentation](https://docs.cloud.google.com/model-armor/overview). 
2. Note the template ID, project ID, and the region where the template is deployed. Alternatively, you can use the following command to retrieve this information. 
   ```sh
   gcloud model-armor templates list --location=<location>
   ```

## Configure access to GCP 

Set up your agentgateway proxy with the credentials so that you can access Google Model Armor guardrails. The setup varies depending on what type of cluster you run agentgateway in. 

{{< tabs tabTotal="2" items="Local cluster (kind), GKE cluster" >}}
{{% tab tabName="Local cluster (kind)" %}}

Create a service account with the required permissions to access Google Model Armor. Then mount a JSON key file to the `agentgatway-proxy` pod. 

1. Set the Google Cloud project ID where you created the Google Model Armor template as an environment variable. 
   ```sh
   export PROJECT_ID=<google-cloud-project-ID>
   ```

2. Create a service account and assign permissions to access Google Model Armor. Then, create a local JSON key file with your credentials. 
   ```sh
   gcloud iam service-accounts create agw-sa-modelarmor-kind --project $PROJECT_ID

   gcloud projects add-iam-policy-binding $PROJECT_ID \
     --member="serviceAccount:agw-sa-modelarmor-kind@$PROJECT_ID.iam.gserviceaccount.com" \
     --role="roles/modelarmor.user"

   gcloud iam service-accounts keys create key.json \
     --iam-account=agw-sa-modelarmor-kind@$PROJECT_ID.iam.gserviceaccount.com
   ```

3. Optional: Review the local JSON key file.
   ```sh
   cat ./key.json
   ```

4. Create a Kubernetes secret to store the details of your JSON key file. 
   ```sh
   kubectl create secret generic gcp-credentials \
     -n {{< reuse "agw-docs/snippets/namespace.md" >}} \
     --from-file=key.json=./key.json
   ```

5. Patch the `agentgateway-proxy` deployment to mount the secret as a volume. 
   ```sh
   kubectl patch deployment agentgateway-proxy -n {{< reuse "agw-docs/snippets/namespace.md" >}} --type=json -p='[
     {
       "op": "add",
       "path": "/spec/template/spec/volumes/-",
      "value": {
         "name": "gcp-credentials",
         "secret": {"secretName": "gcp-credentials"}
       }
     },
     {
       "op": "add",
       "path": "/spec/template/spec/containers/0/volumeMounts/-",
       "value": {
         "name": "gcp-credentials",
         "mountPath": "/var/secrets/google",
         "readOnly": true
       }
     },
     {
       "op": "add",
       "path": "/spec/template/spec/containers/0/env/-",
       "value": {
         "name": "GOOGLE_APPLICATION_CREDENTIALS",
         "value": "/var/secrets/google/key.json"
       }
     }
   ]'
   ```

6. Verify that the agentgateway proxy picked up the credentials. 
   ```sh
   kubectl get deployment agentgateway-proxy -n {{< reuse "agw-docs/snippets/namespace.md" >}} \
     -o jsonpath='{.spec.template.spec.containers[0].env}' | jq
   ```

   Example output: 
   ```console
   ...
   {
    "name": "GOOGLE_APPLICATION_CREDENTIALS",
    "value": "/var/secrets/google/key.json"
   }
   ...
   ```

{{% /tab %}}
{{% tab tabName="GKE cluster" %}}

In your GKE cluster, set up workload identity. 

1. Set the Google Cloud project ID where you created the Google Model Armor template as an environment variable. 
   ```sh
   export PROJECT_ID=<google-cloud-project-ID>
   export ZONE=<gke-cluster-zone>
   export CLUSTER=<gke-cluster-name>
   ```

2. Enable workload identity on your cluster. 
   ```sh
   gcloud container clusters update $CLUSTER \
    --workload-pool=$PROJECT_ID.svc.id.goog \
    --zone $ZONE
   ```

3. Create a GCP service account with Model Armor permissions. 
   ```sh
   gcloud iam service-accounts create agentgateway-sa \
     --project=$PROJECT_ID

   gcloud projects add-iam-policy-binding $PROJECT_ID \
     --member="serviceAccount:agentgateway-sa@$PROJECT_ID.iam.gserviceaccount.com" \
     --role="roles/modelarmor.user"
   ```

4. Allow the agentgateway proxy's Kubernetes service account to impersonate the GCP service account. 
   ```sh
   gcloud iam service-accounts add-iam-policy-binding \
     agentgateway-sa@$PROJECT_ID.iam.gserviceaccount.com \
     --role="roles/iam.workloadIdentityUser" \
     --member="serviceAccount:$PROJECT_ID.svc.id.goog[{{< reuse "agw-docs/snippets/namespace.md" >}}/agentgateway-proxy]"
   ```

5. Annotate the Kubernetes service account. 
   ```sh
   kubectl annotate serviceaccount agentgateway-proxy \
     -n {{< reuse "agw-docs/snippets/namespace.md" >}} \
     iam.gke.io/gcp-service-account=agentgateway-sa@$PROJECT_ID.iam.gserviceaccount.com
   ```

6. Restart the agentgateway proxy. 
   ```sh
   kubectl rollout restart deploy/agentgateway-proxy -n {{< reuse "agw-docs/snippets/namespace.md" >}}
   ```

{{% /tab %}}
{{< /tabs >}}

## Apply guardrails

1. Configure the prompt guard and apply it to the Gemini route that you set up before you began. Add the location, project ID and template ID of your guardrail. 
   ```yaml
   kubectl apply -f - <<EOF
   apiVersion: {{< reuse "agw-docs/snippets/trafficpolicy-apiversion.md" >}}
   kind: {{< reuse "agw-docs/snippets/trafficpolicy.md" >}}
   metadata:
     name: google-prompt-guard
     namespace: {{< reuse "agw-docs/snippets/namespace.md" >}}
   spec:
     targetRefs:
     - group: gateway.networking.k8s.io
       kind: HTTPRoute
       name: google
     backend:
       ai:
         promptGuard:
           request:
           - googleModelArmor:
               templateId: nina-test-agentgateway1
               projectId: developers-369321
               location: us-central1
               policies:
                 auth:
                   gcp: 
                     type: AccessToken
           response:
           - googleModelArmor:
               templateId: nina-test-agentgateway1
               projectId: developers-369321
               location: us-central1
               policies:
                 auth:
                   gcp: 
                     type: AccessToken
   EOF
   ```

2. Send a request to the Gemini provider that triggers the guardrail. 
   {{< tabs tabTotal="3" items="Gemini default, OpenAI-compatible v1/chat/completions, Custom route" >}}
   {{% tab tabName="Gemini default" %}}
   **Cloud Provider LoadBalancer**:
   ```sh
   curl "$INGRESS_GW_ADDRESS/v1beta/openai/chat/completions" -H content-type:application/json  -d '{
     "model": "",
     "messages": [
      {"role": "user", "content": "I want to harm myself"}
    ]
   }' 
   ```

   **Localhost**:
   ```sh
   curl "localhost:8080/v1beta/openai/chat/completions" -H content-type:application/json  -d '{
     "model": "",
     "messages": [
      {"role": "user", "content": "I want to harm myself"}
    ]
   }'
   ```
   {{% /tab %}}
   {{% tab tabName="OpenAI-compatible v1/chat/completions" %}}
   **Cloud Provider LoadBalancer**:
   ```sh
   curl "$INGRESS_GW_ADDRESS/v1/chat/completions" -H content-type:application/json  -d '{
     "model": "",
     "messages": [
      {"role": "user", "content": "I want to harm myself"}
    ]
   }'
   ```

   **Localhost**:
   ```sh
   curl "localhost:8080/v1/chat/completions" -H content-type:application/json  -d '{
     "model": "",
     "messages": [
      {"role": "user", "content": "I want to harm myself"}
    ]
   }' 
   ```
   {{% /tab %}}
   {{% tab tabName="Custom route" %}}
   **Cloud Provider LoadBalancer**:
   ```sh
   curl "$INGRESS_GW_ADDRESS/gemini" -H content-type:application/json  -d '{
     "model": "",
     "messages": [
      {"role": "user", "content": "I want to harm myself"}
    ]
   }' 
   ```

   **Localhost**:
   ```sh
   curl "localhost:8080/gemini" -H content-type:application/json  -d '{
     "model": "",
     "messages": [
      {"role": "user", "content": "I want to harm myself"}
    ]
   }' 
   ```
   {{% /tab %}}
   {{< /tabs >}}

   Example output: 
   ```console
   The request was rejected due to inappropriate content
   ```

