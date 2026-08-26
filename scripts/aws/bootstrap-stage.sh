#!/usr/bin/env bash
set -euo pipefail

STAGE="${1:-}"
DB_URI="${2:-}"

if [ -z "$STAGE" ]; then
  echo "uso: scripts/aws/bootstrap-stage.sh <stage> [uri-do-mongo]" >&2
  exit 1
fi

CONFIG="config/${STAGE}.json"
if [ ! -f "$CONFIG" ]; then
  echo "não existe $CONFIG — crie a configuração do stage antes" >&2
  exit 1
fi

REGION="$(node -p "require('./${CONFIG}').environment.REGION")"
POOL_NAME="health-car-${STAGE}"
CLIENT_NAME="health-car-${STAGE}-web"
PREFIX="/health_car/${STAGE}"

echo "conta $(aws sts get-caller-identity --query Account --output text) · região ${REGION} · stage ${STAGE}"

find_pool() {
  aws cognito-idp list-user-pools --max-results 60 --region "$REGION" \
    --query "UserPools[?Name=='${POOL_NAME}'].Id | [0]" --output text
}

POOL_ID="$(find_pool)"

if [ "$POOL_ID" = "None" ] || [ -z "$POOL_ID" ]; then
  POOL_ID="$(aws cognito-idp create-user-pool \
    --region "$REGION" \
    --pool-name "$POOL_NAME" \
    --username-attributes email \
    --auto-verified-attributes email \
    --mfa-configuration OFF \
    --account-recovery-setting 'RecoveryMechanisms=[{Priority=1,Name=verified_email}]' \
    --admin-create-user-config 'AllowAdminCreateUserOnly=false' \
    --policies 'PasswordPolicy={MinimumLength=8,RequireUppercase=true,RequireLowercase=true,RequireNumbers=true,RequireSymbols=false,TemporaryPasswordValidityDays=7}' \
    --user-pool-tags "project=health_car,stage=${STAGE}" \
    --query 'UserPool.Id' --output text)"
  echo "user pool criado: ${POOL_ID}"
else
  echo "user pool já existe: ${POOL_ID}"
fi

POOL_ARN="$(aws cognito-idp describe-user-pool --user-pool-id "$POOL_ID" --region "$REGION" \
  --query 'UserPool.Arn' --output text)"
ISSUER_URL="https://cognito-idp.${REGION}.amazonaws.com/${POOL_ID}"

CLIENT_ID="$(aws cognito-idp list-user-pool-clients --user-pool-id "$POOL_ID" --region "$REGION" \
  --max-results 60 --query "UserPoolClients[?ClientName=='${CLIENT_NAME}'].ClientId | [0]" --output text)"

if [ "$CLIENT_ID" = "None" ] || [ -z "$CLIENT_ID" ]; then
  CLIENT_ID="$(aws cognito-idp create-user-pool-client \
    --region "$REGION" \
    --user-pool-id "$POOL_ID" \
    --client-name "$CLIENT_NAME" \
    --no-generate-secret \
    --explicit-auth-flows ALLOW_USER_SRP_AUTH ALLOW_REFRESH_TOKEN_AUTH \
    --prevent-user-existence-errors ENABLED \
    --access-token-validity 1 --id-token-validity 1 --refresh-token-validity 30 \
    --token-validity-units 'AccessToken=hours,IdToken=hours,RefreshToken=days' \
    --read-attributes email email_verified name \
    --write-attributes email name \
    --query 'UserPoolClient.ClientId' --output text)"
  echo "app client criado: ${CLIENT_ID}"
else
  echo "app client já existe: ${CLIENT_ID}"
fi

for GROUP in owner admin; do
  if aws cognito-idp get-group --user-pool-id "$POOL_ID" --group-name "$GROUP" --region "$REGION" >/dev/null 2>&1; then
    echo "grupo ${GROUP} já existe"
  else
    aws cognito-idp create-group --user-pool-id "$POOL_ID" --group-name "$GROUP" \
      --region "$REGION" --description "Papel ${GROUP} do HealthCar" >/dev/null
    echo "grupo ${GROUP} criado"
  fi
done

put_parameter() {
  local NAME="$1"
  local VALUE="$2"
  local TYPE="$3"

  if aws ssm get-parameter --name "$NAME" --region "$REGION" >/dev/null 2>&1; then
    if [ "$TYPE" = "SecureString" ]; then
      echo "parâmetro ${NAME} já existe — mantido"
      return
    fi
    aws ssm put-parameter --name "$NAME" --value "$VALUE" --type "$TYPE" \
      --overwrite --region "$REGION" >/dev/null
    echo "parâmetro ${NAME} atualizado"
    return
  fi

  aws ssm put-parameter --name "$NAME" --value "$VALUE" --type "$TYPE" \
    --region "$REGION" --tags "Key=project,Value=health_car" "Key=stage,Value=${STAGE}" >/dev/null
  echo "parâmetro ${NAME} criado"
}

put_parameter "${PREFIX}/user_pool_id" "$POOL_ID" String
put_parameter "${PREFIX}/client_id" "$CLIENT_ID" String
put_parameter "${PREFIX}/cognito_url" "$ISSUER_URL" String
put_parameter "${PREFIX}/cognito_user_pool_arn" "$POOL_ARN" String

if aws ssm get-parameter --name "${PREFIX}/encryption_key" --region "$REGION" >/dev/null 2>&1; then
  echo "parâmetro ${PREFIX}/encryption_key já existe — mantido"
else
  put_parameter "${PREFIX}/encryption_key" "$(openssl rand -hex 32)" SecureString
fi

if aws ssm get-parameter --name "${PREFIX}/vapid_public_key" --region "$REGION" >/dev/null 2>&1; then
  echo "parâmetros VAPID já existem — mantidos"
else
  VAPID="$(node -e "const k=require('web-push').generateVAPIDKeys();process.stdout.write(k.publicKey+' '+k.privateKey)")"
  put_parameter "${PREFIX}/vapid_public_key" "${VAPID%% *}" SecureString
  put_parameter "${PREFIX}/vapid_private_key" "${VAPID##* }" SecureString
fi

if [ -n "$DB_URI" ]; then
  put_parameter "${PREFIX}/db" "$DB_URI" SecureString
elif aws ssm get-parameter --name "${PREFIX}/db" --region "$REGION" >/dev/null 2>&1; then
  echo "parâmetro ${PREFIX}/db já existe — mantido"
else
  echo "parâmetro ${PREFIX}/db AINDA NÃO EXISTE — rode de novo passando a URI do Mongo"
fi

echo
echo "front (.env do stage ${STAGE}):"
echo "NEXT_PUBLIC_COGNITO_USER_POOL_ID=${POOL_ID}"
echo "NEXT_PUBLIC_COGNITO_USER_POOL_CLIENT_ID=${CLIENT_ID}"
echo "NEXT_PUBLIC_COGNITO_REGION=${REGION}"
echo "NEXT_PUBLIC_VAPID_PUBLIC_KEY=$(aws ssm get-parameter --name "${PREFIX}/vapid_public_key" --with-decryption --region "$REGION" --query 'Parameter.Value' --output text)"
