#!/bin/bash
set -e

# Create all GradeLoop service databases (idempotent)
# This script runs once on first PostgreSQL container initialization.

psql -v ON_ERROR_STOP=1 --username "$POSTGRES_USER" --dbname "postgres" <<-'EOSQL'
SELECT 'CREATE DATABASE "iam-db"'
WHERE NOT EXISTS (SELECT FROM pg_database WHERE datname = 'iam-db')\gexec

SELECT 'CREATE DATABASE "email-db"'
WHERE NOT EXISTS (SELECT FROM pg_database WHERE datname = 'email-db')\gexec

SELECT 'CREATE DATABASE "academic-db"'
WHERE NOT EXISTS (SELECT FROM pg_database WHERE datname = 'academic-db')\gexec

SELECT 'CREATE DATABASE "assessment-db"'
WHERE NOT EXISTS (SELECT FROM pg_database WHERE datname = 'assessment-db')\gexec

SELECT 'CREATE DATABASE "cipas-db"'
WHERE NOT EXISTS (SELECT FROM pg_database WHERE datname = 'cipas-db')\gexec

SELECT 'CREATE DATABASE "keystroke-db"'
WHERE NOT EXISTS (SELECT FROM pg_database WHERE datname = 'keystroke-db')\gexec
EOSQL

echo "All GradeLoop databases verified/created."
