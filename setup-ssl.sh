#!/usr/bin/env bash
#
# HTTPS with nginx + certbot (Let's Encrypt) for the docker-compose deploy.
#
#   ./setup-ssl.sh <web-domain> [api-domain] [email]
#
# Example:
#   ./setup-ssl.sh trading.example.com api.trading.example.com you@example.com
#   ./setup-ssl.sh trading.example.com            # api domain defaults to api.<web-domain>
#
# Prerequisites:
#   - ./deploy.sh has run at least once (containers + .env exist)
#   - DNS A records for BOTH domains point to this server's public IP
#
# What it does:
#   1. installs nginx + certbot (Debian/Ubuntu apt)
#   2. writes reverse-proxy config: web-domain → :3000, api-domain → :4000
#   3. obtains certificates via certbot --nginx (auto-renewal is systemd-managed)
#   4. updates .env to the https URLs, binds app ports to 127.0.0.1,
#      and rebuilds the web container (NEXT_PUBLIC_API_URL is baked at build time)
#
set -euo pipefail
cd "$(dirname "$0")"

WEB_DOMAIN="${1:-}"
API_DOMAIN="${2:-}"
EMAIL="${3:-${EMAIL:-}}"

if [ -z "$WEB_DOMAIN" ]; then
  echo "Usage: ./setup-ssl.sh <web-domain> [api-domain] [email]"
  echo "   eg: ./setup-ssl.sh trading.example.com api.trading.example.com you@example.com"
  exit 1
fi
API_DOMAIN="${API_DOMAIN:-api.$WEB_DOMAIN}"

# apex domain with a www record in DNS → cover www in the cert too
WWW_DOMAIN=""
if [ "${WEB_DOMAIN#www.}" = "$WEB_DOMAIN" ] && getent hosts "www.$WEB_DOMAIN" >/dev/null 2>&1; then
  WWW_DOMAIN="www.$WEB_DOMAIN"
  echo "• www.$WEB_DOMAIN found in DNS — it will be included in the certificate."
fi

if [ "$(id -u)" -ne 0 ]; then
  echo "✗ Run as root (or with sudo)."; exit 1
fi
if [ ! -f .env ]; then
  echo "✗ .env not found — run ./deploy.sh first."; exit 1
fi
if ! command -v apt-get >/dev/null 2>&1; then
  echo "✗ This script supports Debian/Ubuntu (apt). For other distros install"
  echo "  nginx + certbot manually, then mirror the config below."
  exit 1
fi

SERVER_IP=$(hostname -I 2>/dev/null | awk '{print $1}')
for d in "$WEB_DOMAIN" "$API_DOMAIN"; do
  RESOLVED=$(getent hosts "$d" | awk '{print $1}' | head -1 || true)
  if [ -z "$RESOLVED" ]; then
    echo "⚠ DNS for $d does not resolve yet — certbot will fail until the A record exists."
  elif [ -n "$SERVER_IP" ] && [ "$RESOLVED" != "$SERVER_IP" ]; then
    echo "⚠ $d resolves to $RESOLVED but this server looks like $SERVER_IP — double-check the A record."
  fi
done

echo "── Installing nginx + certbot ─────────────────────────────"
apt-get update -qq
DEBIAN_FRONTEND=noninteractive apt-get install -y -qq nginx certbot python3-certbot-nginx

echo "── Writing nginx reverse-proxy config ─────────────────────"
cat > /etc/nginx/sites-available/trading.conf <<EOF
server {
    listen 80;
    server_name $WEB_DOMAIN${WWW_DOMAIN:+ $WWW_DOMAIN};

    location / {
        proxy_pass http://127.0.0.1:3000;
        proxy_http_version 1.1;
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
    }
}

server {
    listen 80;
    server_name $API_DOMAIN;

    client_max_body_size 25m;

    location / {
        proxy_pass http://127.0.0.1:4000;
        proxy_http_version 1.1;
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
    }
}
EOF
ln -sf /etc/nginx/sites-available/trading.conf /etc/nginx/sites-enabled/trading.conf
rm -f /etc/nginx/sites-enabled/default
nginx -t
systemctl enable --now nginx
systemctl reload nginx

echo "── Obtaining certificates (Let's Encrypt) ─────────────────"
CERTBOT_EMAIL_ARGS=(--register-unsafely-without-email)
if [ -n "$EMAIL" ]; then CERTBOT_EMAIL_ARGS=(-m "$EMAIL"); fi
CERTBOT_DOMAINS=(-d "$WEB_DOMAIN" -d "$API_DOMAIN")
if [ -n "$WWW_DOMAIN" ]; then CERTBOT_DOMAINS+=(-d "$WWW_DOMAIN"); fi
certbot --nginx --redirect --agree-tos -n "${CERTBOT_EMAIL_ARGS[@]}" \
  "${CERTBOT_DOMAINS[@]}"

echo "── Switching the app to the https URLs ────────────────────"
set_env() {
  local key=$1 val=$2
  if grep -q "^${key}=" .env; then
    sed -i "s|^${key}=.*|${key}=${val}|" .env
  else
    echo "${key}=${val}" >> .env
  fi
}
set_env NEXT_PUBLIC_API_URL "https://$API_DOMAIN"
set_env WEB_ORIGIN "https://$WEB_DOMAIN"
set_env BIND_IP "127.0.0.1"

# rebuild: the web bundle bakes NEXT_PUBLIC_API_URL in at build time
docker compose up -d --build

echo
echo "✓ HTTPS is live:"
echo "    Web : https://$WEB_DOMAIN"
echo "    API : https://$API_DOMAIN"
echo "  App ports are now bound to 127.0.0.1 — public traffic goes through nginx only."
echo "  Renewal is automatic (systemd certbot.timer). Test it with:"
echo "    certbot renew --dry-run"
