#!/bin/bash

# CouchDB global changes feed
# outputs a JSON line to stdout like `{ "db_name": "mydb", "doc": { "_id": "doc_id" } }` for each change

# Requirements:
# * curl
# * jq

# Usage:
# ./global-changes-feed.sh COUCHDB_URL
# eg: ./global-changes-feed.sh http://localhost:5984

COUCHDB_URL=$1

declare -A update_seqs_per_db

>&2 echo "Listening to changes on $COUCHDB_URL.."

while :
do
  if [ $last_seq ]
  then
    db_updates=$(curl --silent "$COUCHDB_URL/_db_updates?feed=longpoll&since=$last_seq")
  else
    db_updates=$(curl --silent "$COUCHDB_URL/_db_updates?feed=longpoll")
  fi

  last_seq=$(echo "$db_updates" | jq -r '.last_seq')
  db_changes=$(echo "$db_updates" | jq -c '.results[]')

  for db_change in $db_changes ; do
    dbname=$(echo "$db_change" | jq -r '.db_name')
    if [ "$dbname" != "_dbs" ]
    then
      >&2 echo "Found changes on db $dbname"

      since=${update_seqs_per_db[$dbname]}
      if [ $since ]
      then
        >&2 echo "Requesting changes for db $dbname since $since"
        changes=$(curl --silent "$COUCHDB_URL/$dbname/_changes?include_docs=true&since=$since")
      else
        >&2 echo "Requesting changes for db $dbname since the beginning"
        changes=$(curl --silent "$COUCHDB_URL/$dbname/_changes?include_docs=true")
      fi

      >&2 echo "Found changes on db $dbname: $changes"

      update_seqs_per_db["$dbname"]=$(echo "$changes" | jq -r '.last_seq')

      # build change object with db name and filter out design documents
      echo "$changes" \
        | jq -c "{ db_name: \"$dbname\", doc: .results[].doc }" \
        | jq -c 'select( .doc._id | contains("_design/") | not)'
    fi
  done
done
