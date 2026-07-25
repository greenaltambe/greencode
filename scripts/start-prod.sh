#!/bin/bash

echo "Starting GreenCode in production mode..."

# Force clean conflicting containers to avoid daemon name collision errors
echo "Cleaning conflicting containers..."
docker rm -f oj-frontend-prod oj-backend-prod oj-minio-prod oj-mongodb-prod oj-redis-prod 2>/dev/null || true

# Check if .env exists
if [ ! -f .env ]; then
    if [ -f .env.production ]; then
        echo "Copying .env.production to .env..."
        cp .env.production .env
    else
        echo ".env file not found! Please create one from .env.example"
        exit 1
    fi
fi

echo "Building judge executor image..."
docker build -f backend/executor/Dockerfile.executor -t oj-executor backend/executor/

docker compose -f docker-compose.prod.yml up --build -d

echo ""
echo "GreenCode started successfully in production mode."
