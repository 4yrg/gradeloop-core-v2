# CIPAS Syntactics DB scripts

## 01-create-cipas-db.sh

Runs at Postgres **first init** (empty volume) to create the `cipas-db` database. Mounted by `compose.yaml` into the postgres service.

## If you already have a Postgres volume

Init scripts run only when the data directory is empty. If your Postgres container was created earlier **without** this script, create the database once:

```bash
docker exec -it gradeloop-postgres psql -U gradeloop -d postgres -c 'CREATE DATABASE "cipas-db";'
```

Use the same user as in your `.env` (`GRA_DB_USER`, default `gradeloop`).
