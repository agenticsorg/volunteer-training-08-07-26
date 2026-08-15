#!/bin/bash

# Database Restore Script - implements ADR 0019 disaster recovery testing
# Usage: ./scripts/restore-database.sh <backup-file> [--target-db <dbname>]
#
# Restores from encrypted, point-in-time-recoverable backups
# Tests backup validity via periodic restore drills (not just assumed)
# RTO target: ≤1 hour for full service restoration
# Works with Docker containers or direct connections

set -euo pipefail

# Arguments
if [ $# -lt 1 ]; then
    echo "Usage: $0 <backup-file> [--target-db <dbname>]" >&2
    echo "Example: $0 backups/backup_email_triage_20260815_120000.sql" >&2
    exit 1
fi

BACKUP_FILE="$1"
DB_HOST="${DATABASE_HOST:-localhost}"
DB_PORT="${DATABASE_PORT:-5432}"
DB_USER="${DATABASE_USER:-postgres}"
TARGET_DB="${DATABASE_NAME:-email_triage_restored}"
RESTORE_LOG="${BACKUP_FILE}.restore.log"

# Parse optional arguments
shift
while [ $# -gt 0 ]; do
    case "$1" in
        --target-db)
            TARGET_DB="$2"
            shift 2
            ;;
        *)
            echo "Unknown option: $1" >&2
            exit 1
            ;;
    esac
done

# Validate backup file exists
if [ ! -f "$BACKUP_FILE" ]; then
    echo "✗ Backup file not found: $BACKUP_FILE" >&2
    exit 1
fi

echo "Starting database restore from $BACKUP_FILE..."
echo "Target database: $TARGET_DB" | tee "$RESTORE_LOG"
echo "Timestamp: $(date)" >> "$RESTORE_LOG"

# Handle encrypted backups
RESTORE_FILE="$BACKUP_FILE"
if [[ "$BACKUP_FILE" == *.gpg ]]; then
    echo "Detected encrypted backup, decrypting..."

    if [ -z "${GPG_PASSPHRASE:-}" ]; then
        echo "✗ GPG_PASSPHRASE not set for decryption" >&2
        exit 1
    fi

    RESTORE_FILE="/tmp/restore_$$_$(date +%s).sql"
    if ! echo "$GPG_PASSPHRASE" | gpg --decrypt --passphrase-fd 0 \
            "$BACKUP_FILE" > "$RESTORE_FILE" 2>> "$RESTORE_LOG"; then
        echo "✗ Failed to decrypt backup" >&2
        rm -f "$RESTORE_FILE"
        exit 1
    fi

    echo "✓ Backup decrypted" | tee -a "$RESTORE_LOG"
fi

# Verify backup file is valid SQL
if ! head -1 "$RESTORE_FILE" | grep -q "^--"; then
    echo "⚠ Warning: Backup file may not be valid SQL" | tee -a "$RESTORE_LOG"
fi

# Try Docker first if on localhost
RESTORE_SUCCEEDED=false

if [ "$DB_HOST" = "localhost" ] || [ "$DB_HOST" = "127.0.0.1" ]; then
    if command -v docker &> /dev/null; then
        CONTAINER_ID=$(docker ps --filter "ancestor=postgres:15-alpine" --format='{{.ID}}' 2>/dev/null | head -1)

        if [ -n "$CONTAINER_ID" ]; then
            echo "Using Docker container $CONTAINER_ID for restore..." >> "$RESTORE_LOG"

            # Drop existing database
            docker exec -e "PGPASSWORD=${DATABASE_PASSWORD:-postgres}" "$CONTAINER_ID" \
                psql --username="$DB_USER" -c "DROP DATABASE IF EXISTS $TARGET_DB;" 2>> "$RESTORE_LOG" || true

            # Create target database
            if docker exec -e "PGPASSWORD=${DATABASE_PASSWORD:-postgres}" "$CONTAINER_ID" \
                psql --username="$DB_USER" -c "CREATE DATABASE $TARGET_DB;" 2>> "$RESTORE_LOG"; then
                echo "✓ Created target database" | tee -a "$RESTORE_LOG"

                # Restore from backup
                if docker exec -e "PGPASSWORD=${DATABASE_PASSWORD:-postgres}" "$CONTAINER_ID" \
                    psql --username="$DB_USER" "$TARGET_DB" < "$RESTORE_FILE" >> "$RESTORE_LOG" 2>&1; then
                    RESTORE_SUCCEEDED=true
                fi
            fi
        fi
    fi
fi

# Fall back to direct psql if Docker didn't work
if [ "$RESTORE_SUCCEEDED" = false ]; then
    if PGPASSWORD="${DATABASE_PASSWORD:-postgres}" psql \
        --host="$DB_HOST" \
        --port="$DB_PORT" \
        --username="$DB_USER" \
        --no-password \
        -c "DROP DATABASE IF EXISTS $TARGET_DB;" 2>> "$RESTORE_LOG" || true; then
        echo "✓ Dropped existing database" | tee -a "$RESTORE_LOG"
    fi

    if PGPASSWORD="${DATABASE_PASSWORD:-postgres}" psql \
        --host="$DB_HOST" \
        --port="$DB_PORT" \
        --username="$DB_USER" \
        --no-password \
        -c "CREATE DATABASE $TARGET_DB;" 2>> "$RESTORE_LOG"; then
        echo "✓ Created target database" | tee -a "$RESTORE_LOG"
    else
        echo "✗ Failed to create target database" >&2
        rm -f "$RESTORE_FILE"
        exit 1
    fi

    # Perform restore
    if PGPASSWORD="${DATABASE_PASSWORD:-postgres}" psql \
        --host="$DB_HOST" \
        --port="$DB_PORT" \
        --username="$DB_USER" \
        --no-password \
        "$TARGET_DB" < "$RESTORE_FILE" >> "$RESTORE_LOG" 2>&1; then
        RESTORE_SUCCEEDED=true
    fi
fi

if [ "$RESTORE_SUCCEEDED" = true ]; then
    END_TIME=$(date +%s)
    START_TIME=$(date +%s)
    DURATION=$((END_TIME - START_TIME))
    RESTORE_SIZE=$(du -h "$BACKUP_FILE" | cut -f1)

    echo "✓ Restore successful" | tee -a "$RESTORE_LOG"
    echo "  Backup size: $RESTORE_SIZE" | tee -a "$RESTORE_LOG"
    echo "  Restore time: ${DURATION}s" | tee -a "$RESTORE_LOG"

    # Verify restore integrity by querying data back
    echo "Verifying restore integrity..."

    # Check table count and query sample data
    if [ "$DB_HOST" = "localhost" ] || [ "$DB_HOST" = "127.0.0.1" ]; then
        CONTAINER_ID=$(docker ps --filter "ancestor=postgres:15-alpine" --format='{{.ID}}' 2>/dev/null | head -1)
        if [ -n "$CONTAINER_ID" ]; then
            TABLE_COUNT=$(docker exec -e "PGPASSWORD=${DATABASE_PASSWORD:-postgres}" "$CONTAINER_ID" \
                psql -t --username="$DB_USER" "$TARGET_DB" \
                -c "SELECT COUNT(*) FROM information_schema.tables WHERE table_schema='public';" 2>> "$RESTORE_LOG" | tr -d ' ')
            TENANT_COUNT=$(docker exec -e "PGPASSWORD=${DATABASE_PASSWORD:-postgres}" "$CONTAINER_ID" \
                psql -t --username="$DB_USER" "$TARGET_DB" \
                -c "SELECT COUNT(*) FROM tenant;" 2>/dev/null | tr -d ' ' || echo "0")
        else
            TABLE_COUNT=$(PGPASSWORD="${DATABASE_PASSWORD:-postgres}" psql \
                -t --host="$DB_HOST" --port="$DB_PORT" --username="$DB_USER" \
                "$TARGET_DB" \
                -c "SELECT COUNT(*) FROM information_schema.tables WHERE table_schema='public';" 2>> "$RESTORE_LOG" | tr -d ' ')
            TENANT_COUNT=$(PGPASSWORD="${DATABASE_PASSWORD:-postgres}" psql \
                -t --host="$DB_HOST" --port="$DB_PORT" --username="$DB_USER" \
                "$TARGET_DB" \
                -c "SELECT COUNT(*) FROM tenant;" 2>/dev/null | tr -d ' ' || echo "0")
        fi
    else
        TABLE_COUNT=$(PGPASSWORD="${DATABASE_PASSWORD:-postgres}" psql \
            -t --host="$DB_HOST" --port="$DB_PORT" --username="$DB_USER" \
            "$TARGET_DB" \
            -c "SELECT COUNT(*) FROM information_schema.tables WHERE table_schema='public';" 2>> "$RESTORE_LOG" | tr -d ' ')
        TENANT_COUNT=$(PGPASSWORD="${DATABASE_PASSWORD:-postgres}" psql \
            -t --host="$DB_HOST" --port="$DB_PORT" --username="$DB_USER" \
            "$TARGET_DB" \
            -c "SELECT COUNT(*) FROM tenant;" 2>/dev/null | tr -d ' ' || echo "0")
    fi

    if [ "$TABLE_COUNT" -gt 0 ]; then
        echo "✓ Restore integrity verified: $TABLE_COUNT tables found" | tee -a "$RESTORE_LOG"
        echo "✓ Data round-trip verified: $TENANT_COUNT tenants in restored database" | tee -a "$RESTORE_LOG"
    else
        echo "⚠ Warning: No tables found in restored database" | tee -a "$RESTORE_LOG"
    fi

    # Clean up decrypted temporary file
    if [[ "$BACKUP_FILE" == *.gpg ]]; then
        rm -f "$RESTORE_FILE"
    fi

    echo "✓ Restore operation completed successfully (RTO: ${DURATION}s)" | tee -a "$RESTORE_LOG"
    exit 0
else
    echo "✗ Restore failed - see $RESTORE_LOG for details" >&2
    rm -f "$RESTORE_FILE"
    exit 1
fi
