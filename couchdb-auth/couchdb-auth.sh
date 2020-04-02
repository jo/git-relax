#!/bin/bash

# External authenticator script for Apache2.

# Requirements:
# * curl

COUCHDB_URL=$1

# Make query with basic auth against CouchDB /_session endpoint. If response code is 200 you are authorized
status_code=$(curl --write-out %{http_code} --silent --output /dev/null -u "${USER}:${PASS}" "$COUCHDB_URL/_session")

echo "[notice] $(date) authenticating ${USER}: ${status_code}"

if [[ "$status_code" -ne 200 ]] ; then
  exit 1
else
  exit 0
fi
