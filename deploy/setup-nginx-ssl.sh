#!/bin/bash
# =============================================================
# Darbby — إعداد nginx و SSL لكل الدومينات
# الاستخدام: bash /var/www/darbby/deploy/setup-nginx-ssl.sh
# =============================================================
set -e

DEPLOY_DIR="/var/www/darbby/deploy"
EMAIL="admin@darbby.co"   # ← غيّر هذا لإيميلك

DOMAINS=(
  "app.darbby.co"
  "partners.darbby.co"
  "staff.darbby.co"
  "api.darbby.co"
)

echo "======================================"
echo "  Darbby — إعداد nginx + SSL"
echo "======================================"

# إنشاء مجلد للـ logs
mkdir -p /var/log/darbby

# ─── نسخ إعدادات nginx ──────────────────────────────────────
echo ""
echo "⏳ نسخ إعدادات nginx..."
for domain in "${DOMAINS[@]}"; do
  cp "$DEPLOY_DIR/nginx/$domain.conf" "/etc/nginx/sites-available/$domain"
  ln -sf "/etc/nginx/sites-available/$domain" "/etc/nginx/sites-enabled/$domain"
  echo "  ✅ $domain"
done

# حذف الصفحة الافتراضية
rm -f /etc/nginx/sites-enabled/default

# التحقق من صحة الإعدادات
echo ""
echo "⏳ التحقق من إعدادات nginx..."
nginx -t

# إعادة تشغيل nginx
systemctl reload nginx
echo "✅ nginx يعمل"

# ─── إصدار شهادات SSL ──────────────────────────────────────
echo ""
echo "⏳ إصدار شهادات SSL..."
echo "⚠️  تأكد أن DNS جاهز قبل هذه الخطوة!"
echo ""

for domain in "${DOMAINS[@]}"; do
  echo "🔐 إصدار شهادة لـ $domain..."
  certbot --nginx \
    -d "$domain" \
    --non-interactive \
    --agree-tos \
    --email "$EMAIL" \
    --redirect
  echo "✅ SSL جاهز لـ $domain"
done

# ─── تجديد تلقائي ──────────────────────────────────────────
echo ""
echo "⏳ إعداد تجديد تلقائي للشهادات..."
systemctl enable certbot.timer
systemctl start certbot.timer

echo ""
echo "======================================"
echo "✅ nginx + SSL جاهز لكل الدومينات!"
echo ""
for domain in "${DOMAINS[@]}"; do
  echo "  🔒 https://$domain"
done
echo "======================================"
