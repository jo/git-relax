#!/bin/bash

# Git post receive hook to sync push events to CouchDB.

# Requirements:
# * curl

COUCHDB_URL=http://admin:admin@localhost:5984

repofilename=$(pwd)

reponame=$(basename $repofilename '.git')
repodirname=$(dirname $repofilename)
username=$(basename $repodirname)

# read receive ref info from stdin:
while read line
do
  previous=$(echo "$line" | cut -d " " -f1)
  current=$(echo "$line" | cut -d " " -f2)
  ref=$(echo "$line" | cut -d " " -f3)
  branchname=$(basename "$ref")

  id="repo:$reponame:branch:$branchname:ref:$current"

  payload="{\"_id\":\"$id\"}"

  # TODO: use credentials hopefully (or not hähä) available as environment variable
  curl -s -XPOST "$COUCHDB_URL/$username" -d "$payload" -H 'Content-Type:application/json'
done < /dev/stdin

