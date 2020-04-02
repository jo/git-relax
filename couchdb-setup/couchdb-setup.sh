#!/bin/bash

# Setup CouchDB

# Dependencies:
# * curl

# Usage:
# ./setup-couchdb.sh COUCHDB_URL
# eg: ./setup-couchdb.sh http://admin:admin@localhost:5984

COUCHDB_URL=$1

echo "CouchDB Setup started..."

echo "waiting for CouchDB to come up"
until $(curl --output /dev/null --silent --head --fail "$COUCHDB_URL"); do
    printf '.'
    sleep 1
done

echo "cluster setup"
# TODO: get username and password from environment variables or args
curl -XPOST --silent "$COUCHDB_URL/_cluster_setup" \
  -d '{"action":"enable_single_node","username":"admin","password":"admin","bind_address":"0.0.0.0","port":5984,"singlenode":true}' \
  -H 'Content-Type:application/json'

echo "configure global changes feed"
curl -XPUT --silent "$COUCHDB_URL/_global_changes"
curl -XPUT --silent "$COUCHDB_URL/_node/nonode@nohost/_config/global_changes/update_db" -d '"true"'

echo "configure _users db for public signup"
curl -XPUT --silent "$COUCHDB_URL/_node/nonode@nohost/_config/couchdb/users_db_security_editable" -d '"true"'
curl -XPUT --silent "$COUCHDB_URL/_users/_security" -d '{}'

echo "configure CORS"
curl -XPUT --silent "$COUCHDB_URL/_node/nonode@nohost/_config/httpd/enable_cors" -d '"true"'
curl -XPUT --silent "$COUCHDB_URL/_node/nonode@nohost/_config/cors/origins" -d '"*"'
curl -XPUT --silent "$COUCHDB_URL/_node/nonode@nohost/_config/cors/credentials" -d '"true"'
curl -XPUT --silent "$COUCHDB_URL/_node/nonode@nohost/_config/cors/methods" -d '"GET, PUT, POST, HEAD, DELETE"'
curl -XPUT --silent "$COUCHDB_URL/_node/nonode@nohost/_config/cors/headers" -d '"accept, authorization, content-type, origin, referer, x-csrf-token"'

echo "configure session timeout"
curl -XPUT --silent "$COUCHDB_URL/_node/nonode@nohost/_config/couch_httpd_auth/timeout" -d '"86400"'

echo "CouchDB setup complete."
