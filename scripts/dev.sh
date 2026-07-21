#!/bin/bash

echo "Starting Online Judge in development mode..."

# Build judge executor image (the Debian one with compilers)
echo "Building judge executor Docker image..."
docker build -f backend/executor/Dockerfile.executor -t oj-executor backend/executor/

# Check if .env exists
if [ ! -f .env ]; then
    echo ".env file not found! Please create one from .env.example"
    exit 1
fi

# Start all services
echo "Starting all services with Docker Compose..."
docker compose up --build