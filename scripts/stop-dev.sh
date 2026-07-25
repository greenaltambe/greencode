#!/bin/bash

echo "Stopping development services..."
docker compose -f docker-compose.dev.yml down
echo "Services stopped."
