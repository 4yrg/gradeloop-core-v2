#!/bin/bash
# Create cipas-db for CIPAS Syntactics (idempotent: ignores "already exists")
psql -v ON_ERROR_STOP=0 --username "$POSTGRES_USER" --dbname "${POSTGRES_DB:-postgres}" -c 'CREATE DATABASE "cipas-db";' || true
