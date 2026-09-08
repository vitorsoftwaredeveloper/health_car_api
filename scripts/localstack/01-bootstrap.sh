#!/bin/bash
set -euo pipefail

BUCKET="health-car-api-local-attachments"
QUEUE="health-car-api-local-notifications"

awslocal s3api create-bucket --bucket "$BUCKET"

awslocal s3api put-bucket-cors --bucket "$BUCKET" --cors-configuration '{
  "CORSRules": [
    {
      "AllowedOrigins": ["http://localhost:3000"],
      "AllowedMethods": ["GET", "PUT", "HEAD"],
      "AllowedHeaders": ["*"],
      "ExposeHeaders": ["ETag"],
      "MaxAgeSeconds": 600
    }
  ]
}'

awslocal sqs create-queue --queue-name "${QUEUE}-dlq"

DLQ_ARN=$(awslocal sqs get-queue-attributes \
  --queue-url "http://localhost:4566/000000000000/${QUEUE}-dlq" \
  --attribute-names QueueArn \
  --query 'Attributes.QueueArn' --output text)

awslocal sqs create-queue --queue-name "$QUEUE" --attributes "{
  \"VisibilityTimeout\": \"180\",
  \"RedrivePolicy\": \"{\\\"deadLetterTargetArn\\\":\\\"${DLQ_ARN}\\\",\\\"maxReceiveCount\\\":\\\"5\\\"}\"
}"

awslocal ssm put-parameter --name /health_car/local/db --type SecureString \
  --value "mongodb://host.docker.internal:27017/health_car?replicaSet=rs0" --overwrite

awslocal ssm put-parameter --name /health_car/local/encryption_key --type SecureString \
  --value "0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef" --overwrite

echo "localstack bootstrap concluido"
