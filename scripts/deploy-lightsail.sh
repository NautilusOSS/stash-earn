#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

SERVICE_NAME="${LIGHTSAIL_SERVICE_NAME:-stash-earn}"
AWS_REGION="${AWS_REGION:-us-east-1}"
CONTAINER_NAME="${LIGHTSAIL_CONTAINER_NAME:-app}"
IMAGE_LABEL="${LIGHTSAIL_IMAGE_LABEL:-latest}"
ENV_FILE="${ENV_FILE:-$ROOT_DIR/.env}"
SKIP_BUILD="${SKIP_BUILD:-false}"

if [[ ! -f "$ENV_FILE" ]]; then
  echo "Missing env file: $ENV_FILE" >&2
  exit 1
fi

if ! command -v lightsailctl >/dev/null 2>&1; then
  echo "lightsailctl is required (brew install lightsailctl or see AWS docs)." >&2
  exit 1
fi

if [[ -z "${DOCKER_HOST:-}" ]] && [[ -S "${HOME}/.docker/run/docker.sock" ]]; then
  export DOCKER_HOST="unix://${HOME}/.docker/run/docker.sock"
fi

DEPLOY_DIR="$ROOT_DIR/deploy/lightsail"
mkdir -p "$DEPLOY_DIR"

python3 - "$ENV_FILE" "$DEPLOY_DIR" "$CONTAINER_NAME" "$SERVICE_NAME" "$IMAGE_LABEL" <<'PY'
import json
import re
import sys
from pathlib import Path

env_file, deploy_dir, container_name, service_name, image_label = sys.argv[1:6]

def parse_env(path: Path) -> dict[str, str]:
    env: dict[str, str] = {}
    for raw in path.read_text().splitlines():
        line = raw.strip()
        if not line or line.startswith("#"):
            continue
        if line.startswith("export "):
            line = line[len("export ") :].strip()
        if "=" not in line:
            continue
        key, value = line.split("=", 1)
        key, value = key.strip(), value.strip()
        if not re.match(r"^[A-Za-z_][A-Za-z0-9_]*$", key):
            continue
        if len(value) >= 2 and value[0] == value[-1] and value[0] in "\"'":
            value = value[1:-1]
        elif " #" in value:
            value = value.split(" #", 1)[0].rstrip()
        value = value.replace("\\n", "\n")
        env[key] = value
    return env

env = parse_env(Path(env_file))
env.setdefault("NODE_ENV", "production")
env.setdefault("PORT", "8080")
env.setdefault("HOST", "0.0.0.0")
Path(deploy_dir, "runtime-env.json").write_text(json.dumps(env, indent=2) + "\n")

containers = {
    container_name: {
        "image": f":{service_name}.{image_label}",
        "command": [],
        "environment": env,
        "ports": {"8080": "HTTP"},
    }
}
public_endpoint = {
    "containerName": container_name,
    "containerPort": 8080,
    "healthCheck": {
        "healthyThreshold": 2,
        "unhealthyThreshold": 5,
        "timeoutSeconds": 10,
        "intervalSeconds": 30,
        "path": "/",
        "successCodes": "200-499",
    },
}
Path(deploy_dir, "containers.json").write_text(json.dumps(containers, indent=2) + "\n")
Path(deploy_dir, "public-endpoint.json").write_text(json.dumps(public_endpoint, indent=2) + "\n")
PY

if [[ "$SKIP_BUILD" != "true" ]]; then
  echo "Building production bundle locally..."
  VITE_PRIVY_APP_ID="$(python3 -c 'import json;print(json.load(open("deploy/lightsail/runtime-env.json")).get("VITE_PRIVY_APP_ID",""))')"
  VITE_PRIVY_VAULT_ID="$(python3 -c 'import json;print(json.load(open("deploy/lightsail/runtime-env.json")).get("VITE_PRIVY_VAULT_ID",""))')"
  VITE_DEBUG="$(python3 -c 'import json;print(json.load(open("deploy/lightsail/runtime-env.json")).get("VITE_DEBUG","false"))')"
  VITE_BLINK_MERCHANT_ID="$(python3 -c 'import json;print(json.load(open("deploy/lightsail/runtime-env.json")).get("VITE_BLINK_MERCHANT_ID",""))')"
  export VITE_PRIVY_APP_ID VITE_PRIVY_VAULT_ID VITE_DEBUG VITE_BLINK_MERCHANT_ID
  npm run build
fi

echo "Building runtime Docker image..."
docker build --platform linux/amd64 -t "${SERVICE_NAME}:${IMAGE_LABEL}" .

echo "Waiting for Lightsail container service to be READY..."
for _ in $(seq 1 60); do
  state="$(AWS_DEFAULT_REGION="$AWS_REGION" aws lightsail get-container-services \
    --service-name "$SERVICE_NAME" \
    --query 'containerServices[0].state' \
    --output text 2>/dev/null || true)"
  if [[ "$state" == "READY" || "$state" == "RUNNING" || "$state" == "DEPLOYING" ]]; then
    break
  fi
  sleep 10
done

echo "Pushing image to Lightsail registry..."
push_output="$(AWS_DEFAULT_REGION="$AWS_REGION" aws lightsail push-container-image \
  --service-name "$SERVICE_NAME" \
  --label "$IMAGE_LABEL" \
  --image "${SERVICE_NAME}:${IMAGE_LABEL}")"
echo "$push_output"
image_ref="$(printf '%s\n' "$push_output" | sed -n 's/.*Refer to this image as "\([^"]*\)".*/\1/p')"
if [[ -z "$image_ref" ]]; then
  echo "Could not parse pushed image reference from Lightsail output." >&2
  exit 1
fi

python3 - "$DEPLOY_DIR" "$CONTAINER_NAME" "$image_ref" <<'PY'
import json
import sys
from pathlib import Path

deploy_dir, container_name, image_ref = sys.argv[1:4]
containers_path = Path(deploy_dir) / "containers.json"
containers = json.loads(containers_path.read_text())
containers[container_name]["image"] = image_ref
containers_path.write_text(json.dumps(containers, indent=2) + "\n")
print(f"Using image {image_ref}")
PY

echo "Creating Lightsail deployment..."
AWS_DEFAULT_REGION="$AWS_REGION" aws lightsail create-container-service-deployment \
  --service-name "$SERVICE_NAME" \
  --cli-input-json "$(python3 - <<PY
import json
from pathlib import Path
root = Path("$ROOT_DIR")
containers = json.loads((root / "deploy/lightsail/containers.json").read_text())
public_endpoint = json.loads((root / "deploy/lightsail/public-endpoint.json").read_text())
print(json.dumps({"containers": containers, "publicEndpoint": public_endpoint}))
PY
)"

url="$(AWS_DEFAULT_REGION="$AWS_REGION" aws lightsail get-container-services \
  --service-name "$SERVICE_NAME" \
  --query 'containerServices[0].url' \
  --output text)"
echo "Deployed. Public URL: $url"
echo "Add this URL to Privy Dashboard → Allowed domains if login is blocked in production."
