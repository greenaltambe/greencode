#!/bin/bash

echo "Starting GreenCode in production mode..."

if [ ! -f .env.production ]; then
    echo ".env.production not found!"
    exit 1
fi

echo "Building judge executor image..."
docker build -f backend/executor/Dockerfile.executor -t oj-executor backend/executor/

docker compose -f docker-compose.prod.yml up --build -d

echo ""
echo "GreenCode started successfully."