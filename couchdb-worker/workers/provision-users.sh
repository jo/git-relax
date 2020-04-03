#!/bin/bash

# Provision Users
# - create user database
# - configure user database security
# - update user doc with `provisionedAt` timestamp

COUCHDB_URL=$1

>&2 echo "Creating user dbs on $COUCHDB_URL.."

while read line; do
  dbname=$(echo "$line" | jq -r '.db_name' 2>/dev/null)
  # only operate on _users database
  if [ "$dbname" = "_users" ]
  then
    id=$(echo "$line" | jq -r '.doc._id')
    # ignore _design and _local documents
    if [[ "$id" != "_*" ]]
    then
      already_provisioned=$(echo "$line" | jq -r '.doc.provisionedAt')
      # skip if user database already provisioned
      if [ "$already_provisioned" = "null" ]
      then
        username=$(echo "$line" | jq -r '.doc.name')
        >&2 echo "Provisioning user $username"
        
        create_db_response=$(curl --silent -XPUT "$COUCHDB_URL/$username")
        update_security_response=$(
          curl --silent -XPUT "$COUCHDB_URL/$username/_security" \
            -d "{\"members\":{\"roles\":[\"_admin\"],\"names\":[\"$username\"]},\"admins\":{\"roles\":[\"_admin\"],\"names\":[\"$username\"]}}" \
            -H "Content-Type:application/json")
        now=$(date --iso-8601=seconds)
        doc=$(echo "$line" | jq '.doc' | jq ".provisionedAt = \"$now\"")
        update_user_doc_response=$(
          echo "$doc" | \
            curl --silent -XPUT "$COUCHDB_URL/_users/org.couchdb.user:$username" \
            -d @- \
            -H "Content-Type:application/json"
        )
        echo "{}" | jq -c "{ type: \"provision-user\", user: \"$username\", create: $create_db_response, security: $update_security_response, doc: $update_user_doc_response }"
      fi
    fi
  fi
done
