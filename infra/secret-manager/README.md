# Secret Manager

Two secrets, both created by you in Cloud Shell and never in the repository. There are no service-account key
files anywhere. With `GEMINI_PROVIDER=vertex-ai`, the Gemini key is not needed (ADR-010).

| Secret | Read by | Replication |
|---|---|---|
| `mongodb-uri` | `sentinel-core`, `sentinel-stream` (`roles/secretmanager.secretAccessor` on this secret only) | user-managed, `asia-southeast1` |
| `gemini-api-key` | `sentinel-core` only | user-managed, `asia-southeast1` |

Store or rotate the Gemini API key with hidden input:

```bash
bash infra/cloud-build/scripts/store-gemini-api-key.sh <project-id>
```

Create it once; the value is read from standard input so it never lands in shell history or the repository:

```bash
gcloud secrets create mongodb-uri --replication-policy=user-managed --locations=asia-southeast1
gcloud secrets versions add mongodb-uri --data-file=-
```

Nothing has been created yet.
