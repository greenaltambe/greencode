#!/bin/bash

echo "======================================="
echo "GreenCode Production Reset"
echo "======================================="
echo ""
echo "This will:"
echo "  • Stop all production containers"
echo "  • Remove all production volumes"
echo "  • Remove unused Docker resources"
echo ""
read -p "Type 'yes' to reset production environment: " response

if [ "$response" != "yes" ]; then
    echo "Reset cancelled."
    exit 0
fi

echo "Stopping production containers and removing volumes..."
docker compose -f docker-compose.prod.yml down -v

docker system prune -f

echo ""
echo "Production reset complete."
