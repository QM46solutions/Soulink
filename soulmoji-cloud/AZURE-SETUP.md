# Soulmoji AI on Azure Container Apps

The AI that makes benchmark-quality Soulmojis (LivePortrait, `tools/soulmoji-ai/soulmoji_ai.py`) runs as a
container on Azure Container Apps in Central India. It **scales to zero**: no cost while nobody makes Soulmojis.

| | |
|---|---|
| Image | `ghcr.io/qm46solutions/soulmoji-ai:latest` (public), built by `.github/workflows/soulmoji-ai.yml` |
| Size | 2 vCPU, 4 GiB, 0–1 copies, port 7860 |
| Wakes | when a Soulmoji selfie is taken, or Soulmoji is opened with expressions still missing |
| Sleeps | about 5 minutes after the last request |
| Cost | Consumption plan free allowance each month (vCPU-seconds + GiB-seconds); roughly 150–200 selfies a month fit in it. After that roughly ₹2–3 per selfie (12 moods). |

## One-time setup (Azure Cloud Shell)

1. portal.azure.com → sign in with the account that has the Soulink subscription → the `>_` (Cloud Shell) icon at the top → **Bash**.
2. Paste this and press Enter (takes ~5 minutes):

```bash
RG=soulink-ai; LOC=centralindia; ENV=soulink-ai-env; APP=soulmoji-ai
az extension add --name containerapp --upgrade -y >/dev/null 2>&1
az provider register -n Microsoft.App --wait
az provider register -n Microsoft.OperationalInsights --wait
az group create -n $RG -l $LOC -o none
az containerapp env create -n $ENV -g $RG -l $LOC --logs-destination none -o none
TOKEN=$(openssl rand -hex 24)
FQDN=$(az containerapp create -n $APP -g $RG --environment $ENV \
  --image ghcr.io/qm46solutions/soulmoji-ai:latest --target-port 7860 --ingress external \
  --cpu 2 --memory 4Gi --min-replicas 0 --max-replicas 1 \
  --scale-rule-name http --scale-rule-type http --scale-rule-http-concurrency 10 \
  --secrets ai-token=$TOKEN --env-vars SOULMOJI_AI_TOKEN=secretref:ai-token \
  --query properties.configuration.ingress.fqdn -o tsv)
echo; echo "SOULMOJI_AI_URL=https://$FQDN"; echo "SOULMOJI_AI_TOKEN=$TOKEN"
curl -s --max-time 240 https://$FQDN/health; echo
```

3. It prints two lines, `SOULMOJI_AI_URL=...` and `SOULMOJI_AI_TOKEN=...`. Put them in Render (below).
   The last line is the AI's health check (`"ok": true`); the first wake can take a couple of minutes.

## Render

Soulink service → Environment → add/replace, then **Save changes** (Render restarts the server):

| Key | Value |
|---|---|
| SOULMOJI_ENGINE | `ai` |
| SOULMOJI_AI_FEATURES | `edit` |
| SOULMOJI_AI_URL | from step 3 |
| SOULMOJI_AI_TOKEN | from step 3 |

If the AI is ever down, the app keeps showing the built-in Soulmojis; nothing breaks.

## After changing the AI recipes

Push → the "Soulmoji AI image" workflow builds and tests a new image (~20–30 min, test pictures are kept on the run's
page). Then, in Cloud Shell:

```bash
az containerapp update -n soulmoji-ai -g soulink-ai --image ghcr.io/qm46solutions/soulmoji-ai:<7-letter commit id>
```

## Turning it off

Render: set `SOULMOJI_ENGINE=builtin`. To remove the Azure part completely: `az group delete -n soulink-ai`.
