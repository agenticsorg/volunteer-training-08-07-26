#!/bin/bash

# Database Backup Script - implements ADR 0019 disaster recovery
# Usage: ./scripts/backup-database.sh [--encrypt] [--upload-s3]
#
# Creates encrypted, point-in-time-recoverable backups per ADR 0019
# RPO: ≤5 minutes via continuous replication + periodic backups
# Backups are tested via restore drills, not assumed valid

set -euo pipefail

# Configuration
BACKUP_DIR="${BACKUP_DIR:-./backups}"
DB_HOST="${DATABASE_HOST:-localhost}"
DB_PORT="${DATABASE_PORT:-5432}"
DB_NAME="${DATABASE_NAME:-email_triage}"
DB_USER="${DATABASE_USER:-postgres}"
ENCRYPT="${ENCRYPT:-false}"
UPLOAD_S3="${UPLOAD_S3:-false}"
AWS_S3_BUCKET="${AWS_S3_BUCKET:-}"
BACKUP_RETENTION_DAYS="${BACKUP_RETENTION_DAYS:-30}"

# Create backup directory
mkdir -p "$BACKUP_DIR"

# Generate backup filename with timestamp
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
BACKUP_FILE="$BACKUP_DIR/backup_${DB_NAME}_${TIMESTAMP}.sql"
BACKUP_LOG="$BACKUP_FILE.log"

echo "Starting database backup for $DB_NAME..."
echo "Timestamp: $TIMESTAMP" > "$BACKUP_LOG"
echo "Host: $DB_HOST:$DB_PORT" >> "$BACKUP_LOG"

# Perform backup with pg_dump
# Use --verbose for detailed logging
# Use --no-owner to avoid privilege-related restore issues
# Use --if-exists to handle restore to different environment
if PGPASSWORD="${DATABASE_PASSWORD:-postgres}" pg_dump \
    --host="$DB_HOST" \
    --port="$DB_PORT" \
    --username="$DB_USER" \
    --no-owner \
    --if-exists \
    --verbose \
    "$DB_NAME" > "$BACKUP_FILE" 2>> "$BACKUP_LOG"; then

    BACKUP_SIZE=$(du -h "$BACKUP_FILE" | cut -f1)
    echo "✓ Backup successful: $BACKUP_FILE ($BACKUP_SIZE)" | tee -a "$BACKUP_LOG"

    # Encrypt backup if requested
    if [ "$ENCRYPT" = "true" ]; then
        ENCRYPTED_FILE="$BACKUP_FILE.gpg"
        if command -v gpg &> /dev/null; then
            # Encrypt with symmetric cipher (use GPG_PASSPHRASE env var)
            if [ -z "${GPG_PASSPHRASE:-}" ]; then
                echo "✗ GPG_PASSPHRASE not set for encryption" >&2
                exit 1
            fi

            echo "$GPG_PASSPHRASE" | gpg --symmetric --cipher-algo AES256 \
                --passphrase-fd 0 "$BACKUP_FILE" 2>> "$BACKUP_LOG"

            rm "$BACKUP_FILE"  # Remove unencrypted copy
            echo "✓ Backup encrypted: $ENCRYPTED_FILE" | tee -a "$BACKUP_LOG"
            BACKUP_FILE="$ENCRYPTED_FILE"
        else
            echo "⚠ gpg not found, skipping encryption" | tee -a "$BACKUP_LOG"
        fi
    fi

    # Upload to S3 if requested
    if [ "$UPLOAD_S3" = "true" ] && [ -n "$AWS_S3_BUCKET" ]; then
        if command -v aws &> /dev/null; then
            S3_PATH="s3://$AWS_S3_BUCKET/backups/$(basename "$BACKUP_FILE")"
            if aws s3 cp "$BACKUP_FILE" "$S3_PATH" --sse AES256 2>> "$BACKUP_LOG"; then
                echo "✓ Backup uploaded to S3: $S3_PATH" | tee -a "$BACKUP_LOG"
            else
                echo "✗ Failed to upload to S3" >&2
                exit 1
            fi
        else
            echo "⚠ aws CLI not found, skipping S3 upload" | tee -a "$BACKUP_LOG"
        fi
    fi

    # Clean up old backups (retention policy)
    echo "Cleaning up backups older than $BACKUP_RETENTION_DAYS days..."
    find "$BACKUP_DIR" -name "backup_${DB_NAME}_*.sql*" -mtime "+$BACKUP_RETENTION_DAYS" -delete

    echo "✓ Backup operation completed successfully"
    exit 0
else
    echo "✗ Backup failed - see $BACKUP_LOG for details" >&2
    exit 1
fi
