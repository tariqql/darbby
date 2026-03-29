#!/bin/bash
# Darbby — Run all table creation scripts across 7 databases
# Usage: sudo -u postgres bash ~/darbby/scripts/run-all-tables.sh

set -e

SQL="$HOME/darbby/scripts/create-tables.sql"

echo "Creating tables across all 7 Darbby databases..."
sudo -u postgres psql < "$SQL"
echo "Done!"
