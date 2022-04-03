#!/bin/bash

# Start Worker Pipeline
# - listen to global changes feed
# - pipe changes feed to provision users
# - pipe changes feed to provision repos

COUCHDB_URL=$1
script_path=$(dirname "$0")

echo "CouchDB Worker started..."

echo "waiting for CouchDB to come up"
until $(curl --output /dev/null --silent --head --fail "$COUCHDB_URL"); do
    printf '.'
    sleep 1
done

$script_path/global-changes-feed.sh "$COUCHDB_URL" \
  | tee >($script_path/workers/provision-users.sh "$COUCHDB_URL") \
  | tee >($script_path/workers/provision-repos.sh "$COUCHDB_URL" "$2")
