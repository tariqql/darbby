#!/bin/bash
# =============================================================
# Darbby — سكريبت الإعداد الأول للسيرفر
# شغّله مرة واحدة فقط على Droplet الجديد
# الاستخدام: bash setup.sh
# =============================================================
set -e

echo "======================================"
echo "  Darbby — إعداد السيرفر"
echo "======================================"

# ─── 1. تحديث النظام ───────────────────────────────────────
echo ""
echo "⏳ [1/7] تحديث حزم النظام..."
apt-get update -y && apt-get upgrade -y

# ─── 2. تثبيت الأدوات الأساسية ─────────────────────────────
echo ""
echo "⏳ [2/7] تثبيت الأدوات الأساسية..."
apt-get install -y curl git unzip nginx certbot python3-certbot-nginx ufw

# ─── 3. تثبيت Node.js 20 ────────────────────────────────────
echo ""
echo "⏳ [3/7] تثبيت Node.js 20..."
curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
apt-get install -y nodejs
echo "Node: $(node -v) | npm: $(npm -v)"

# ─── 4. تثبيت pnpm و PM2 ────────────────────────────────────
echo ""
echo "⏳ [4/7] تثبيت pnpm و PM2..."
npm install -g pnpm pm2
pm2 startup systemd -u root --hp /root | tail -1 | bash || true
echo "pnpm: $(pnpm -v) | pm2: $(pm2 -v)"

# ─── 5. إعداد الجدار الناري ─────────────────────────────────
echo ""
echo "⏳ [5/7] إعداد الجدار الناري UFW..."
ufw allow OpenSSH
ufw allow 'Nginx Full'
ufw --force enable
echo "UFW status: $(ufw status | head -1)"

# ─── 6. استنساخ المشروع ─────────────────────────────────────
echo ""
echo "⏳ [6/7] استنساخ مشروع Darbby من GitHub..."
if [ -d "/var/www/darbby" ]; then
  echo "المجلد موجود، تخطي الاستنساخ..."
else
  git clone https://github.com/tariqql/darbby.git /var/www/darbby
fi

# ─── 7. إعداد ملف البيئة ────────────────────────────────────
echo ""
echo "⏳ [7/7] إنشاء ملف البيئة (.env)..."
if [ ! -f "/var/www/darbby/artifacts/api-server/.env" ]; then
  cat > /var/www/darbby/artifacts/api-server/.env << 'EOF'
NODE_ENV=production
PORT=8080

# قواعد البيانات — عدّل هذه القيم
DATABASE_URL=postgresql://postgres:PASSWORD@localhost:5432/darbby_shared
DATABASE_URL_SHARED=postgresql://postgres:PASSWORD@localhost:5432/darbby_shared
DATABASE_URL_MERCHANTS=postgresql://postgres:PASSWORD@localhost:5432/darbby_merchants
DATABASE_URL_STAFF=postgresql://postgres:PASSWORD@localhost:5432/darbby_staff
DATABASE_URL_AUTH=postgresql://postgres:PASSWORD@localhost:5432/darbby_auth

# الأسرار — غيّر هذه القيم
SESSION_SECRET=CHANGE_THIS_TO_RANDOM_64_CHARS
JWT_SECRET=CHANGE_THIS_TO_RANDOM_64_CHARS
EOF
  echo "✅ تم إنشاء .env — يجب تعديله بقيم حقيقية!"
  echo "   👉  nano /var/www/darbby/artifacts/api-server/.env"
else
  echo ".env موجود، تخطي الإنشاء."
fi

echo ""
echo "======================================"
echo "✅ الإعداد الأول اكتمل!"
echo ""
echo "الخطوات التالية:"
echo "  1. عدّل ملف البيئة:  nano /var/www/darbby/artifacts/api-server/.env"
echo "  2. شغّل سكريبت النشر: bash /var/www/darbby/deploy/deploy.sh"
echo "======================================"
