#!/bin/bash

echo "======================================="
echo "GreenCode Development Reset"
echo "======================================="
echo ""
echo "This will:"
echo "  • Stop all development containers"
echo "  • Remove all development volumes"
echo "  • Remove unused Docker resources"
echo ""
read -p "Type 'yes' to reset development environment: " response

if [ "$response" != "yes" ]; then
    echo "Reset cancelled."
    exit 0
fi

echo "Stopping development containers and removing volumes..."
docker compose -f docker-compose.dev.yml down -v

docker system prune -f

echo ""
echo "Development reset complete."
