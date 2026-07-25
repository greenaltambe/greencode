#!/bin/bash

echo "Starting Online Judge in development mode..."

# Force clean conflicting containers to avoid daemon name collision errors
echo "Cleaning conflicting containers..."
docker rm -f oj-frontend-dev oj-backend-dev oj-minio-dev oj-mongodb-dev oj-redis-dev 2>/dev/null || true

# Build judge executor image (the Debian one with compilers)
echo "Building judge executor Docker image..."
docker build -f backend/executor/Dockerfile.executor -t oj-executor backend/executor/

# Check if .env exists
if [ ! -f .env ]; then
    echo ".env file not found! Please create one from .env.example"
    exit 1
fi

# Start all services
echo "Starting all services with Docker Compose (Development)..."
docker compose -f docker-compose.dev.yml up --build
