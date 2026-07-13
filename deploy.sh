#!/bin/bash
set -e

APP="/home/khbkadmin/kaptivating_homes"

echo "==> Pulling latest code..."
cd "$APP" && git pull

echo "==> Stopping PM2..."
pm2 stop all

echo "==> Installing backend dependencies..."
cd "$APP/backend" && npm install

echo "==> Building backend..."
cd "$APP/backend" && npm run build

echo "==> Starting API so frontend build can reach it..."
pm2 start "$APP/backend/dist/server.js" --name api 2>/dev/null || pm2 restart api
sleep 3

echo "==> Installing frontend dependencies..."
cd "$APP/frontend" && npm install

echo "==> Building frontend..."
cd "$APP/frontend" && npm run build

echo "==> Copying static assets into standalone..."
cp -r "$APP/frontend/.next/static" "$APP/frontend/.next/standalone/frontend/.next/static"
cp -r "$APP/frontend/public" "$APP/frontend/.next/standalone/frontend/public"

echo "==> Installing sharp for image optimization..."
cd "$APP/frontend/.next/standalone" && npm install sharp --no-save

echo "==> Restarting PM2..."
pm2 start all
pm2 save

echo "==> Done."
pm2 list
