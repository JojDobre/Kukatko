#!/bin/sh
# Každú noc (od BACKUP_HOUR) zálohuje databázu do /backups a nechá posledných BACKUP_KEEP_DAYS dní.
# Voliteľne dá vedieť monitoringu (HC_BACKUP_URL z healthchecks.io).
set -eu
# Ak zlyhá pg_dump, nech zlyhá celá rúra (inak by vznikla prázdna záloha).
set -o pipefail
HOUR="${BACKUP_HOUR:-2}"
KEEP="${BACKUP_KEEP_DAYS:-14}"
export PGPASSWORD="$POSTGRES_PASSWORD"
echo "Zálohy: každý deň od ${HOUR}:00, uchovávam ${KEEP} dní v /backups"

while true; do
  today=$(date +%F)
  file="/backups/kukatko-$today.sql.gz"
  if [ "$(date +%H)" -ge "$HOUR" ] && [ ! -f "$file" ]; then
    # Kým robot nenaplní databázu (napr. hneď po prvom spustení), zálohu nerobíme.
    titles=$(psql -h db -U "$POSTGRES_USER" -d "$POSTGRES_DB" -tAc "SELECT count(*) FROM titles" 2>/dev/null || echo 0)
    if [ "${titles:-0}" -eq 0 ] 2>/dev/null; then
      sleep 600
      continue
    fi
    if pg_dump -h db -U "$POSTGRES_USER" "$POSTGRES_DB" | gzip > /backups/.tmp.sql.gz; then
      mv /backups/.tmp.sql.gz "$file"
      find /backups -name 'kukatko-*.sql.gz' -mtime +"$KEEP" -delete
      echo "$(date -Iseconds) Záloha hotová: $file ($(du -h "$file" | cut -f1))"
      [ -n "${HC_BACKUP_URL:-}" ] && wget -q -O /dev/null "$HC_BACKUP_URL" || true
    else
      echo "$(date -Iseconds) CHYBA: záloha zlyhala"
      rm -f /backups/.tmp.sql.gz
      [ -n "${HC_BACKUP_URL:-}" ] && wget -q -O /dev/null "${HC_BACKUP_URL%/}/fail" || true
    fi
  fi
  sleep 600
done
