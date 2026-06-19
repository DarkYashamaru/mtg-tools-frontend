#!/bin/bash

# Exit immediately if any command fails
set -e

echo "📦 Starting the build process..."
npm run build

echo "🧹 Clearing out the old frontend files..."
# Using -rf with a trailing slash to clear contents, or mkdir just in case it doesn't exist
sudo rm -rf /var/www/magic-frontend/*

echo "🚀 Copying new build files to production..."
sudo cp -r /home/yasha/servers/www/magic-frontend/dist/. /var/www/magic-frontend/

echo "✅ Deployment completed successfully!"
