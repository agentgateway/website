1. Create a Secret for the database credentials. PostgreSQL and the proxy use the same Secret, keeping the password out of your Helm values.

   This testing example creates the `agw` user with the password `password`. For a custom password, use only letters and numbers. The password becomes part of a connection URL, where characters such as `@`, `:`, and `/` have special meanings.

   ```sh
   kubectl create secret generic agentgateway-postgres \
     -n {{< reuse "agw-docs/snippets/namespace.md" >}} \
     --from-literal=POSTGRES_USER=agw \
     --from-literal=POSTGRES_PASSWORD='password' \
     --from-literal=POSTGRES_DB=agw
   ```

2. Deploy PostgreSQL with a PersistentVolumeClaim that uses your cluster's default StorageClass. The volume preserves request logs and saved UI configuration when the PostgreSQL pod restarts.

   ```sh
   kubectl apply -n {{< reuse "agw-docs/snippets/namespace.md" >}} -f - <<'EOF'
   apiVersion: v1
   kind: PersistentVolumeClaim
   metadata:
     name: postgres-data
   spec:
     accessModes:
     - ReadWriteOnce
     resources:
       requests:
         storage: 1Gi
   ---
   apiVersion: apps/v1
   kind: Deployment
   metadata:
     name: postgres
   spec:
     replicas: 1
     strategy:
       type: Recreate
     selector:
       matchLabels:
         app: postgres
     template:
       metadata:
         labels:
           app: postgres
       spec:
         containers:
         - name: postgres
           image: postgres:{{< reuse "agw-docs/versions/postgres.md" >}}
           envFrom:
           - secretRef:
               name: agentgateway-postgres
           env:
           - name: PGDATA
             value: /var/lib/postgresql/data/pgdata
           ports:
           - containerPort: 5432
           readinessProbe:
             exec:
               command: ["sh", "-c", "pg_isready -U \"$POSTGRES_USER\" -d \"$POSTGRES_DB\""]
             periodSeconds: 5
           volumeMounts:
           - name: data
             mountPath: /var/lib/postgresql/data
         volumes:
         - name: data
           persistentVolumeClaim:
             claimName: postgres-data
   ---
   apiVersion: v1
   kind: Service
   metadata:
     name: postgres
   spec:
     selector:
       app: postgres
     ports:
     - port: 5432
       targetPort: 5432
   EOF
   ```

3. Verify that PostgreSQL is ready and its PersistentVolumeClaim is `Bound`. The pod becomes ready when PostgreSQL accepts connections.

   ```sh
   kubectl rollout status deploy/postgres -n {{< reuse "agw-docs/snippets/namespace.md" >}}
   kubectl get pvc postgres-data -n {{< reuse "agw-docs/snippets/namespace.md" >}}
   ```

   Example output:

   ```txt
   deployment "postgres" successfully rolled out
   NAME            STATUS   VOLUME                                     CAPACITY   ACCESS MODES   STORAGECLASS   AGE
   postgres-data   Bound    pvc-32a0dca7-4ddd-458c-85a4-1b1b9d37140c   1Gi        RWO            standard       13s
   ```

   If the claim stays `Pending`, check whether your cluster has a default StorageClass. To select a StorageClass, set `spec.storageClassName` in the PersistentVolumeClaim. Alternatively, use a managed PostgreSQL service.
