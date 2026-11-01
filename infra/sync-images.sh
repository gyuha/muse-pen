#!/bin/sh
set -eu
: "${S3_BUCKET:?S3_BUCKET is required}"
: "${AWS_ACCESS_KEY_ID:?AWS_ACCESS_KEY_ID is required}"
: "${AWS_SECRET_ACCESS_KEY:?AWS_SECRET_ACCESS_KEY is required}"
interval=${IMAGE_SYNC_INTERVAL:-300}
case "$interval" in
  ''|*[!0-9]*|0) echo 'IMAGE_SYNC_INTERVAL must be a positive integer' >&2; exit 1 ;;
esac
trap 'exit 0' TERM INT
while :; do
  # Retain remote objects when local files are deleted; never use --delete.
  if [ -n "${S3_ENDPOINT:-}" ]; then
    aws --endpoint-url "$S3_ENDPOINT" s3 sync /data/images "s3://$S3_BUCKET/images/" || echo 'Image backup failed; retrying next interval' >&2
  else
    aws s3 sync /data/images "s3://$S3_BUCKET/images/" || echo 'Image backup failed; retrying next interval' >&2
  fi
  sleep "$interval" &
  wait $! || true
done
