#!/bin/bash
# =============================================================================
#  Falak.io — database backup (Mac)
#
#  What it does:  makes a READ-ONLY copy of your Falak database
#                 (businesses, members, records, profiles, history)
#                 and saves it as a dated .zip-like folder on your Mac.
#  What it never does: change, delete or upload anything in Supabase.
#
#  Usage:
#     ./falak-backup.sh                  make a backup now
#     ./falak-backup.sh --install-weekly run automatically every Sunday 10:00
#     ./falak-backup.sh --remove-weekly  stop the automatic weekly backup
#     ./falak-backup.sh --forget-password remove the saved password from Keychain
#
#  Your database password is NEVER written in this file. It is asked once and
#  (if you agree) stored in the macOS Keychain, which is encrypted by your Mac.
# =============================================================================
set -euo pipefail

PROJECT_REF="your-project-ref"           # not a secret (it is in your Supabase URL)
DB_USER="postgres.${PROJECT_REF}"
DB_NAME="postgres"
DB_PORT="5432"                               # Session pooler port
KEEP_LAST=12                                 # keep the newest 12 backups (about 3 months)

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
BACKUP_ROOT="${FALAK_BACKUP_DIR:-$HOME/Documents/Falak-Backups}"
SETTINGS="$BACKUP_ROOT/.settings"           # only stores the pooler HOST name (not secret)
KEYCHAIN_SERVICE="falak-io-db-backup"
PLIST="$HOME/Library/LaunchAgents/com.falak.backup.plist"

# Homebrew's PostgreSQL tools (brew install libpq)
for d in /opt/homebrew/opt/libpq/bin /usr/local/opt/libpq/bin; do
  [ -d "$d" ] && PATH="$d:$PATH"
done
export PATH

say() { printf '%s\n' "$*"; }
die() { printf 'ERROR: %s\n' "$*" >&2; exit 1; }
interactive() { [ -t 0 ]; }

# ---------- weekly schedule helpers ----------
if [ "${1:-}" = "--install-weekly" ]; then
  mkdir -p "$HOME/Library/LaunchAgents" "$BACKUP_ROOT"
  security find-generic-password -s "$KEYCHAIN_SERVICE" -a "$DB_USER" -w >/dev/null 2>&1 \
    || die "Run ./falak-backup.sh once first and choose to save the password in Keychain."
  cat > "$PLIST" <<EOF
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0"><dict>
  <key>Label</key><string>com.falak.backup</string>
  <key>ProgramArguments</key><array><string>/bin/bash</string><string>$SCRIPT_DIR/falak-backup.sh</string></array>
  <key>StartCalendarInterval</key><dict><key>Weekday</key><integer>0</integer><key>Hour</key><integer>10</integer><key>Minute</key><integer>0</integer></dict>
  <key>StandardOutPath</key><string>$BACKUP_ROOT/last-run.log</string>
  <key>StandardErrorPath</key><string>$BACKUP_ROOT/last-run.log</string>
</dict></plist>
EOF
  launchctl unload "$PLIST" 2>/dev/null || true
  launchctl load "$PLIST"
  say "Weekly backup is ON (every Sunday 10:00, or next time the Mac is awake)."
  say "Log file: $BACKUP_ROOT/last-run.log"
  exit 0
fi
if [ "${1:-}" = "--remove-weekly" ]; then
  launchctl unload "$PLIST" 2>/dev/null || true
  rm -f "$PLIST"
  say "Weekly backup is OFF."
  exit 0
fi
if [ "${1:-}" = "--forget-password" ]; then
  security delete-generic-password -s "$KEYCHAIN_SERVICE" -a "$DB_USER" >/dev/null 2>&1 || true
  say "Saved password removed from Keychain."
  exit 0
fi

# ---------- checks ----------
command -v pg_dump >/dev/null || die "pg_dump not found. Install with:  brew install libpq"
mkdir -p "$BACKUP_ROOT"
chmod 700 "$BACKUP_ROOT"

# ---------- pooler host (asked once, not secret) ----------
DB_HOST=""
[ -f "$SETTINGS" ] && DB_HOST="$(cat "$SETTINGS")"
if [ -z "$DB_HOST" ]; then
  interactive || die "First run must be done by hand in Terminal."
  say "Supabase → your project → Connect → Session pooler."
  say "Copy only the host part, it looks like:  aws-0-xx-xxxx-x.pooler.supabase.com"
  read -r -p "Paste host: " DB_HOST
  DB_HOST="$(printf '%s' "$DB_HOST" | tr -d '[:space:]')"
  case "$DB_HOST" in *.pooler.supabase.com) ;; *) die "That does not look like a pooler host." ;; esac
  printf '%s' "$DB_HOST" > "$SETTINGS"
fi

# ---------- password (Keychain or prompt, never stored in a file) ----------
PGPASSWORD="$(security find-generic-password -s "$KEYCHAIN_SERVICE" -a "$DB_USER" -w 2>/dev/null || true)"
if [ -z "$PGPASSWORD" ]; then
  interactive || die "No saved password. Run the script by hand once."
  read -r -s -p "Supabase DATABASE password (typing is hidden): " PGPASSWORD; echo
  [ -n "$PGPASSWORD" ] || die "Empty password."
  read -r -p "Save it in macOS Keychain so weekly backups can run? (y/n) " ans
  if [ "$ans" = "y" ] || [ "$ans" = "Y" ]; then
    security add-generic-password -U -s "$KEYCHAIN_SERVICE" -a "$DB_USER" -w "$PGPASSWORD"
    say "Saved in Keychain."
  fi
fi
export PGPASSWORD PGSSLMODE=require PGHOST="$DB_HOST" PGPORT="$DB_PORT" PGUSER="$DB_USER" PGDATABASE="$DB_NAME"
export PGCONNECT_TIMEOUT=20

# ---------- backup ----------
STAMP="$(date +%Y-%m-%d_%H%M)"
OUT="$BACKUP_ROOT/falak-$STAMP"
mkdir -p "$OUT"
say "Backing up to: $OUT"

# 1) App tables: structure (for reference) and data (for restore)
pg_dump --schema=public --schema-only --no-owner --no-privileges -f "$OUT/schema.sql"
pg_dump --schema=public --data-only  --no-owner --no-privileges -f "$OUT/data.sql"

# 2) Login accounts (emails + encrypted password hashes). Optional at restore time.
pg_dump --data-only --no-owner --no-privileges -t auth.users -t auth.identities -f "$OUT/auth-users.sql" \
  || say "Note: could not copy login accounts (not critical — users can sign up again)."

# 3) Row counts, so you can check a restore matches
psql -X -A -t -F ' | ' -c "
  select 'businesses', count(*) from public.businesses union all
  select 'members',    count(*) from public.members    union all
  select 'profiles',   count(*) from public.profiles   union all
  select 'history',    count(*) from public.history    union all
  select 'records:'||type, count(*) from public.records group by type
  order by 1;" > "$OUT/counts.txt"

unset PGPASSWORD

# 4) Compress into one file and remove the loose folder
tar -czf "$OUT.tar.gz" -C "$BACKUP_ROOT" "falak-$STAMP"
rm -rf "$OUT"
chmod 600 "$OUT.tar.gz"

# 5) Keep only the newest $KEEP_LAST backups
ls -1t "$BACKUP_ROOT"/falak-*.tar.gz 2>/dev/null | tail -n +$((KEEP_LAST + 1)) | while read -r old; do rm -f "$old"; done

SIZE="$(du -h "$OUT.tar.gz" | cut -f1)"
say "Done. Backup file: $OUT.tar.gz ($SIZE)"
say "Tip: also copy it to iCloud Drive / Google Drive / a USB stick."
