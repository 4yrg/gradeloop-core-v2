#!/bin/bash
set -e

psql -v ON_ERROR_STOP=1 --username "$POSTGRES_USER" --dbname "$POSTGRES_DB" <<-EOSQL
    CREATE DATABASE "iam-db";
    CREATE DATABASE "email-db";
CREATE DATABASE "academic-db";
    CREATE DATABASE "assessment-db";
    CREATE DATABASE "cipas-db";
    CREATE DATABASE "keystroke-db";
EOSQL
