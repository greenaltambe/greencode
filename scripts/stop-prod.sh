#!/bin/bash

echo "Stopping production services..."
docker compose -f docker-compose.prod.yml down
echo "Services stopped."
