#!/bin/bash
# =============================================================
# Darbby — سكريبت النشر (شغّله في كل تحديث)
# الاستخدام: bash /var/www/darbby/deploy/deploy.sh
# =============================================================
set -e

DARBBY_DIR="/var/www/darbby"
API_URL="https://api.darbby.co"

echo "======================================"
echo "  Darbby — نشر التحديثات"
echo "======================================"

cd $DARBBY_DIR

# ─── 1. جلب آخر تحديثات ─────────────────────────────────────
echo ""
echo "⏳ [1/6] جلب آخر تحديثات من GitHub..."
git pull origin main

# ─── 2. تثبيت الحزم ─────────────────────────────────────────
echo ""
echo "⏳ [2/6] تثبيت حزم pnpm..."
pnpm install --frozen-lockfile

# ─── 3. بناء تطبيق العميل ───────────────────────────────────
echo ""
echo "⏳ [3/6] بناء تطبيق المسافر (app.darbby.co)..."
cd $DARBBY_DIR/artifacts/client-app
BASE_PATH=/ VITE_API_BASE_URL=$API_URL NODE_ENV=production pnpm build
echo "✅ client-app جاهز في: dist/public/"

# ─── 4. بناء بوابة التاجر ───────────────────────────────────
echo ""
echo "⏳ [4/6] بناء بوابة التاجر (partners.darbby.co)..."
cd $DARBBY_DIR/artifacts/merchant-portal
BASE_PATH=/ VITE_API_BASE_URL=$API_URL NODE_ENV=production pnpm build
echo "✅ merchant-portal جاهز في: dist/public/"

# ─── 5. بناء لوحة الإدارة ───────────────────────────────────
echo ""
echo "⏳ [5/6] بناء لوحة الإدارة (staff.darbby.co)..."
cd $DARBBY_DIR/artifacts/darbby
BASE_PATH=/ VITE_API_BASE_URL=$API_URL NODE_ENV=production pnpm build
echo "✅ darbby (admin) جاهز في: dist/public/"

# ─── 6. تشغيل/إعادة تشغيل API مع PM2 ───────────────────────
echo ""
echo "⏳ [6/6] تشغيل API Server مع PM2..."
cd $DARBBY_DIR/artifacts/api-server
pnpm build

mkdir -p /var/log/darbby

pm2 describe darbby-api > /dev/null 2>&1 && \
  pm2 restart darbby-api || \
  pm2 start dist/index.mjs --name darbby-api \
    --env production \
    --max-memory-restart 512M \
    --log /var/log/darbby/api.log

pm2 save

echo ""
echo "======================================"
echo "✅ النشر اكتمل!"
echo ""
echo "  🌐 تطبيق المسافر   : https://app.darbby.co"
echo "  🏪 بوابة التاجر    : https://partners.darbby.co"
echo "  🛡️  لوحة الإدارة   : https://staff.darbby.co"
echo "  ⚙️  API Server      : https://api.darbby.co"
echo ""
echo "حالة PM2:"
pm2 list
echo "======================================"
