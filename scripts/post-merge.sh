#!/bin/bash
set -e

npm install --legacy-peer-deps 2>&1 || true

echo "Post-merge setup complete"
