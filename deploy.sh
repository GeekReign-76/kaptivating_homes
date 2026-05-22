#!/bin/bash
set -e

APP="/home/khbkadmin/kaptivating_homes"

echo "==> Pulling latest code..."
cd "$APP" && git pull

echo "==> Stopping PM2..."
pm2 stop all

echo "==> Building backend..."
cd "$APP/backend" && npm run build

echo "==> Building frontend..."
cd "$APP/frontend" && npm run build

echo "==> Copying static assets into standalone..."
cp -r "$APP/frontend/.next/static" "$APP/frontend/.next/standalone/frontend/.next/static"
cp -r "$APP/frontend/public" "$APP/frontend/.next/standalone/frontend/public"

echo "==> Restarting PM2..."
pm2 start all
pm2 save

echo "==> Done."
pm2 list
