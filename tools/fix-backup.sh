#!/bin/bash
# VEC portal — replace the nightly backup with one that checks every step, reports its result to the
# portal dashboard, and can be tested any time with:  sudo /opt/vec/bin/backup.sh --check
# Run once on the server:  sudo bash /opt/vec/releases/current/tools/fix-backup.sh
set -uo pipefail
[ "$(id -u)" = 0 ] || { echo "Run with sudo: sudo bash /opt/vec/releases/current/tools/fix-backup.sh"; exit 1; }

cat > /opt/vec/bin/backup.sh <<'EOF'
#!/bin/bash
# Nightly 02:30 (cron): dump the database, upload it to the Lightsail bucket, keep 30 daily + 12 monthly
# copies there and 3 days on the server. Writes /opt/vec/shared/backup-status.json for the portal dashboard.
#   sudo /opt/vec/bin/backup.sh           run a backup now
#   sudo /opt/vec/bin/backup.sh --check   only test the settings and the bucket (nothing is uploaded)
set -uo pipefail
ENV=/opt/vec/shared/backup.env
STATUS=/opt/vec/shared/backup-status.json
CHECK=${1:-}
say() { echo "$(date '+%F %T') $*"; }
fail() {
  say "BACKUP FAILED: $1"
  printf '{"ok":false,"at":"%s","error":"%s"}\n' "$(date -Iseconds)" "$(echo "$1" | tr '"\\' "''" | head -c 300)" > "$STATUS"
  chmod 644 "$STATUS"
  exit 1
}

# 1. settings
[ -f "$ENV" ] || fail "settings file $ENV is missing — copy backup.env.example to backup.env and fill it in"
sed -i 's/\r$//' "$ENV"   # a file pasted from Windows has CR line ends that break the values
set -a; source "$ENV"; set +a
[ -n "${BUCKET:-}" ] && [ "${BUCKET}" != "vec-portal-backups-xxxx" ] || fail "BUCKET is not filled in $ENV (the bucket name from Lightsail → Storage)"
[ -n "${AWS_ACCESS_KEY_ID:-}" ] || fail "AWS_ACCESS_KEY_ID is empty in $ENV (bucket → Permissions → Access keys)"
[ -n "${AWS_SECRET_ACCESS_KEY:-}" ] || fail "AWS_SECRET_ACCESS_KEY is empty in $ENV"
BUCKET="${BUCKET#s3://}"; BUCKET="${BUCKET%/}"
export AWS_DEFAULT_REGION="${AWS_DEFAULT_REGION:-ap-south-1}"
say "settings ok: bucket ${BUCKET}, region ${AWS_DEFAULT_REGION}, key …${AWS_ACCESS_KEY_ID: -4}"

# 2. tools
command -v aws >/dev/null || fail "the AWS command-line tool is not installed (run: sudo snap install aws-cli --classic)"
docker ps --format '{{.Names}}' | grep -qx vec-db || fail "the database container vec-db is not running (sudo docker start vec-db)"

# 3. bucket
OUT=$(aws s3 ls "s3://${BUCKET}/" 2>&1) || {
  case "$OUT" in
    *InvalidAccessKeyId*) fail "the access key ID is wrong or was deleted — create a new key on the bucket's Permissions tab";;
    *SignatureDoesNotMatch*) fail "the secret access key is wrong — create a new key pair and paste both again";;
    *NoSuchBucket*) fail "no bucket called ${BUCKET} — check the exact name in Lightsail → Storage";;
    *AccessDenied*) fail "the key has no access to ${BUCKET} — create the key on THIS bucket's Permissions tab";;
    *PermanentRedirect*|*AuthorizationHeaderMalformed*|*region*) fail "the bucket is in another region — set AWS_DEFAULT_REGION in $ENV to the bucket's region (Mumbai = ap-south-1)";;
    *) fail "cannot reach the bucket: $(echo "$OUT" | tail -1)";;
  esac
}
say "bucket ok"
if [ "$CHECK" = "--check" ]; then
  docker exec vec-db pg_dump -U vec -d vec -Fc --schema-only >/dev/null 2>&1 || fail "pg_dump inside vec-db does not work"
  say "database dump ok — everything is ready (nothing uploaded in --check mode)"
  exit 0
fi

# 4. dump + upload
mkdir -p /opt/vec/backups
STAMP="$(date +%F_%H%M)"
FILE="/opt/vec/backups/vec_${STAMP}.dump"
docker exec vec-db pg_dump -U vec -d vec -Fc > "$FILE" 2>/tmp/vec-pgdump.err || fail "database dump failed: $(tail -1 /tmp/vec-pgdump.err)"
SIZE=$(stat -c %s "$FILE")
[ "$SIZE" -gt 1000 ] || fail "the dump is only ${SIZE} bytes — something is wrong with the database"
OUT=$(aws s3 cp "$FILE" "s3://${BUCKET}/db/daily/vec_${STAMP}.dump" --only-show-errors 2>&1) || fail "upload failed: $(echo "$OUT" | tail -1)"
if [ "$(date +%d)" = "01" ]; then aws s3 cp "$FILE" "s3://${BUCKET}/db/monthly/vec_${STAMP}.dump" --only-show-errors || true; fi
for KIND in daily:30 monthly:12; do
  DIR="${KIND%%:*}"; KEEP="${KIND##*:}"
  aws s3 ls "s3://${BUCKET}/db/${DIR}/" 2>/dev/null | awk '{print $4}' | sort | head -n -"${KEEP}" \
    | xargs -r -I{} aws s3 rm "s3://${BUCKET}/db/${DIR}/{}" --only-show-errors || true
done
find /opt/vec/backups -name '*.dump' -mtime +3 -delete
COUNT=$(aws s3 ls "s3://${BUCKET}/db/daily/" 2>/dev/null | wc -l)
printf '{"ok":true,"at":"%s","file":"vec_%s.dump","bytes":%s,"copies":%s}\n' "$(date -Iseconds)" "$STAMP" "$SIZE" "$COUNT" > "$STATUS"
chmod 644 "$STATUS"
say "backup ok ${FILE} (${SIZE} bytes, ${COUNT} daily copies in the bucket)"
EOF
chmod 750 /opt/vec/bin/backup.sh

# restore helper (for emergencies): sudo /opt/vec/bin/restore.sh vec_2026-11-20_0230.dump
cat > /opt/vec/bin/restore.sh <<'EOF'
#!/bin/bash
# Restore one backup over the current database. Stops the portal while restoring.
#   sudo /opt/vec/bin/restore.sh                          list the copies in the bucket
#   sudo /opt/vec/bin/restore.sh vec_2026-11-20_0230.dump restore that copy
set -euo pipefail
set -a; source /opt/vec/shared/backup.env; set +a
BUCKET="${BUCKET#s3://}"; BUCKET="${BUCKET%/}"; export AWS_DEFAULT_REGION="${AWS_DEFAULT_REGION:-ap-south-1}"
if [ -z "${1:-}" ]; then echo "Daily copies:"; aws s3 ls "s3://${BUCKET}/db/daily/"; echo "Monthly copies:"; aws s3 ls "s3://${BUCKET}/db/monthly/" || true; exit 0; fi
NAME="$1"; DIR=daily; aws s3 ls "s3://${BUCKET}/db/daily/${NAME}" >/dev/null 2>&1 || DIR=monthly
read -r -p "This REPLACES all portal data with ${NAME}. Type RESTORE to continue: " OK
[ "$OK" = "RESTORE" ] || { echo "Cancelled."; exit 1; }
aws s3 cp "s3://${BUCKET}/db/${DIR}/${NAME}" /tmp/restore.dump --only-show-errors
/opt/vec/bin/backup.sh || true   # one last copy of the current data first
systemctl stop vec-web
docker exec -i vec-db pg_restore -U vec -d vec --clean --if-exists --no-owner < /tmp/restore.dump
systemctl start vec-web
rm -f /tmp/restore.dump
echo "Restored ${NAME}. The portal is running again."
EOF
chmod 750 /opt/vec/bin/restore.sh

# make sure the AWS CLI is there (the first set-up may have failed to install it)
if ! command -v aws >/dev/null; then
  echo "Installing the AWS command-line tool..."
  snap install aws-cli --classic >/dev/null 2>&1 || apt-get install -y awscli >/dev/null 2>&1 || true
fi
cat > /etc/cron.d/vec-backup <<'EOF'
30 2 * * * root /opt/vec/bin/backup.sh >> /var/log/vec-backup.log 2>&1
EOF
echo
echo "=== Testing the backup settings ==="
/opt/vec/bin/backup.sh --check && { echo; echo "=== Running the first backup ==="; /opt/vec/bin/backup.sh; }
