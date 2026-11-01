# Single VPS runtime

Run commands from the repository root. Copy `infra/.env.example` to a private file
outside the repository (for example `/tmp/muse-pen.env`) and fill it before starting:

- `SITE_ADDRESS`: public domain for automatic HTTPS, or `http://localhost` for local QA.
- `BASE_URL` and `TRUSTED_ORIGINS`: matching browser origin, e.g. `http://localhost`
  for QA. Trusted origins may be comma separated. API requests use `/api/...`.
- `AUTH_SECRET`: a long random secret, required by production API startup.
- `ADMIN_EMAIL`, `ADMIN_PASSWORD`: optional initial administrator credentials.
- `S3_BUCKET`, `S3_REGION`, `AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY`: backup
  destination and credentials. `S3_ENDPOINT` is optional for AWS S3; set an HTTPS
  endpoint for compatible providers. `IMAGE_SYNC_INTERVAL` defaults to 300 seconds.

```sh
docker compose --env-file /tmp/muse-pen.env -f infra/docker-compose.yml config -q
docker compose --env-file /tmp/muse-pen.env -f infra/docker-compose.yml up --build -d
```

Caddy serves the built web SPA and strips `/api` before proxying to port 3000.
Only Caddy publishes ports. API startup creates the SQLite database and schema.
The API runs TypeScript with tsx, including workspace packages that export source.
Do not scale the API beyond one replica.

Persistent host paths (relative to `infra/`) are `data/sqlite`, `data/images`,
`data/caddy` and `data/caddy-config`. Keep them out of source control and preserve
ownership/permissions when moving hosts. The API and Litestream share a writable
SQLite directory, including WAL files. Caddy certificate state survives restarts.

Litestream continuously replicates the database to `sqlite/muse-pen` in the bucket.
The image backup service syncs to `images/` every configured interval and retries
failures; it retains remote files deleted locally. Inspect service logs to verify
both backup streams. Enable bucket versioning/retention appropriate to recovery needs.

For recovery, stop all services first. With the same backup environment configured,
restore the database to an empty host SQLite directory:

```sh
docker compose --env-file /tmp/muse-pen.env -f infra/docker-compose.yml run --rm --no-deps litestream restore -config /etc/litestream.yml /data/sqlite/muse-pen.db
```

Restore bucket `images/` into `infra/data/images/` using `aws s3 sync` with the same
endpoint and credentials, then start the stack. Never restore over a running DB.
A restore drill and provider spending limits must be checked before production use.
CI only installs, typechecks, builds and tests; it does not deploy.
