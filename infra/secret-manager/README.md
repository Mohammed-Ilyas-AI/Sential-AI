# Secret Manager

The Atlas connection string is the only secret in the system. Vertex AI is called with the service
account's own credentials; there are no API keys and no service-account key files anywhere.

| Secret | Read by | Replication |
|---|---|---|
| `mongodb-uri` | `sentinel-core`, `sentinel-stream` (`roles/secretmanager.secretAccessor` on this secret only) | user-managed, `asia-southeast1` |

Create it once; the value is read from standard input so it never lands in shell history or the repository:

```bash
gcloud secrets create mongodb-uri --replication-policy=user-managed --locations=asia-southeast1
gcloud secrets versions add mongodb-uri --data-file=-
```

Nothing has been created yet.
