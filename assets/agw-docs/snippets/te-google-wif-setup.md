Register Keycloak as an identity provider in a Google Cloud workload identity pool, and give its user access to a Cloud Storage bucket.

1. Set environment variables for your Google Cloud project and the resources that you create. Bucket names are globally unique, so the bucket name includes your project ID.

   ```sh
   export PROJECT_ID=<your-project-id>
   export PROJECT_NUMBER=$(gcloud projects describe $PROJECT_ID --format="value(projectNumber)")
   export POOL_ID=agentgateway-pool
   export PROVIDER_ID=keycloak
   export BUCKET=agentgateway-te-$PROJECT_ID
   ```

2. Enable the APIs that Workload Identity Federation and Cloud Storage use.

   ```sh
   gcloud services enable iam.googleapis.com sts.googleapis.com storage.googleapis.com \
     --project $PROJECT_ID
   ```

3. Create a workload identity pool.

   ```sh
   gcloud iam workload-identity-pools create $POOL_ID \
     --project $PROJECT_ID \
     --location global \
     --display-name "agentgateway token exchange"
   ```

4. Create an OIDC provider in the pool for the Keycloak realm.

   ```sh
   gcloud iam workload-identity-pools providers create-oidc $PROVIDER_ID \
     --project $PROJECT_ID \
     --location global \
     --workload-identity-pool $POOL_ID \
     --issuer-uri "https://keycloak.example.com/realms/agentgateway" \
     --allowed-audiences agentgateway \
     --attribute-mapping "google.subject=assertion.sub" \
     --jwk-json-path jwks.json
   ```

   | Setting | Description |
   | -- | -- |
   | `--issuer-uri` | Must match the `iss` claim of the incoming token exactly. Google requires an `https://` issuer. |
   | `--allowed-audiences` | The `aud` values that Google accepts in the incoming token. The sample realm sets `aud` to `agentgateway`. If you omit this flag, the token's `aud` must be the full provider resource name, `https://iam.googleapis.com/projects/$PROJECT_NUMBER/locations/global/workloadIdentityPools/$POOL_ID/providers/$PROVIDER_ID`. |
   | `--attribute-mapping` | Maps the token's `sub` claim to the Google subject. IAM policies refer to the federated user by this value. |
   | `--jwk-json-path` | Uploads the signing keys that you saved earlier, so Google validates tokens without contacting the issuer. For an IdP with a public `https://` discovery endpoint, omit this flag and Google fetches the keys itself. |

5. Create a bucket with a sample object.

   ```sh
   gcloud storage buckets create gs://$BUCKET --project $PROJECT_ID --location us-central1
   echo "hello from agentgateway" > hello.txt
   gcloud storage cp hello.txt gs://$BUCKET/hello.txt
   ```

6. Grant the Keycloak user read access to the bucket. The member is the federated identity of `testuser`: the workload identity pool plus the `sub` claim that you saved earlier. Use the project number, not the project ID.

   ```sh
   gcloud storage buckets add-iam-policy-binding gs://$BUCKET \
     --member "principal://iam.googleapis.com/projects/$PROJECT_NUMBER/locations/global/workloadIdentityPools/$POOL_ID/subject/$USER_SUB" \
     --role roles/storage.objectViewer
   ```

   IAM changes can take a few minutes to take effect.
