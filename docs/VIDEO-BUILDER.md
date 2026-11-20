# Soulink Studio: video builder + Azure Blob storage

Sparks with several clips or photos, or a Soul Look, are put together by the **video builder** (`builder/`, ffmpeg)
on Azure Container Apps. It also **shrinks every posted video** (`/compress`, `server/src/services/videoShrink.js`):
720p H.264, at most 30 fps, the index at the front so it plays while it downloads, plus a cover picture. A phone's
40+ MB clip becomes about 3 MB; newest Sparks first, then older ones in the background. Videos under 6 MB are left alone. It **scales to zero**: no cost while nobody posts. Photos, videos and voice notes are kept in
**Azure Blob Storage** (container `media`, private) instead of the database.

| | |
|---|---|
| Builder image | `ghcr.io/qm46solutions/soulink-builder:latest`, built and tested by `.github/workflows/builder.yml` |
| Builder size | 1 vCPU, 2 GiB, 0–1 copies, port 8080; a 30 s Spark takes about 20–40 s |
| Storage | Storage account in `soulink-ai` (Central India), Standard LRS, no public access |
| Clean-up | unfinished uploads (`incoming/`) are deleted after 2 days |

## 1. After pushing: make the image public (once)
GitHub → QM46solutions → **Packages** → `soulink-builder` → Package settings → **Change visibility → Public**
(same as `soulmoji-ai`). Check the "Video builder image" run on the Actions tab is green first.

## 2. Azure Cloud Shell (portal.azure.com → `>_` → Bash), about 5 minutes
```bash
RG=soulink-ai; LOC=centralindia; ENV=soulink-ai-env; APP=soulink-builder; SA=soulinkmedia$RANDOM
az extension add --name containerapp --upgrade -y >/dev/null 2>&1
az storage account create -n $SA -g $RG -l $LOC --sku Standard_LRS --kind StorageV2 --min-tls-version TLS1_2 --allow-blob-public-access false -o none
CONN=$(az storage account show-connection-string -n $SA -g $RG -o tsv)
az storage container create -n media --connection-string "$CONN" -o none
az storage account management-policy create --account-name $SA -g $RG --policy '{"rules":[{"enabled":true,"name":"old-uploads","type":"Lifecycle","definition":{"actions":{"baseBlob":{"delete":{"daysAfterModificationGreaterThan":2}}},"filters":{"blobTypes":["blockBlob"],"prefixMatch":["media/incoming/"]}}}]}' -o none
TOKEN=$(openssl rand -hex 24)
FQDN=$(az containerapp create -n $APP -g $RG --environment $ENV \
  --image ghcr.io/qm46solutions/soulink-builder:latest --target-port 8080 --ingress external \
  --cpu 1 --memory 2Gi --min-replicas 0 --max-replicas 1 \
  --scale-rule-name http --scale-rule-type http --scale-rule-http-concurrency 2 \
  --secrets builder-token=$TOKEN --env-vars BUILDER_TOKEN=secretref:builder-token \
  --query properties.configuration.ingress.fqdn -o tsv)
echo; echo "AZURE_STORAGE_CONNECTION_STRING=$CONN"; echo "BUILDER_URL=https://$FQDN"; echo "BUILDER_TOKEN=$TOKEN"
curl -s --max-time 240 https://$FQDN/health; echo
```
It prints three lines. The last line is the builder's health check (`"ok":true`).

## 3. Render (soulink → Environment → Edit)
Paste the three values (`AZURE_STORAGE_CONNECTION_STRING`, `BUILDER_URL`, `BUILDER_TOKEN`) and **Save**. That's all:
with the storage key in, `STORAGE=db` switches to Blob by itself (`STORAGE_AUTO_BLOB=off` stops that). New files go to
Blob and phones load them straight from Azure (a short-lived link, the same for the hour); older files are still read
from the database. The shrinking starts within a minute. When everything looks right, `BLOB_MIGRATE` is set to `on`,
which moves the old files over (each one checked before the database copy is removed).

## Turning it off
Render: `STORAGE=db` and remove `BUILDER_URL` → Sparks with several clips post from the website again (joined in the
browser), and a single video posts as before. Files already in Blob are still read.
To remove the builder completely: `az containerapp delete -n soulink-builder -g soulink-ai`.
