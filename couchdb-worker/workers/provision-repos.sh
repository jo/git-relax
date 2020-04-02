#!/bin/bash

# Provision Repos
# - create repository
# - setup hook
# - update repo doc with `provisionedAt` stamp

COUCH=$1
GITDIR=$2

>&2 echo "Creating repos on $COUCH.."

while read line; do
  dbname=$(echo "$line" | jq -r '.db_name' 2>/dev/null)
  if [[ "$dbname" =~ ^[a-z]+ ]]
  then
    id=$(echo "$line" | jq -r '.doc._id')
    t1=$(echo "$id" | cut -d ':' -f1)
    v1=$(echo "$id" | cut -d ':' -f2)
    t2=$(echo "$id" | cut -d ':' -f3)
    # restrict to repo types
    if [ "$t1" = "repo" ]
    then
      # ignore nested types
      if [ -z "$t2" ]
      then
        already_provisioned=$(echo "$line" | jq -r '.doc.provisionedAt')
        # skip if user database already provisioned
        if [ "$already_provisioned" = "null" ]
        then
          repofilename="$GITDIR/$dbname/$v1.git"
          create_repo_response=$(
            mkdir -p "$repofilename" && cd "$repofilename" && git init --bare
          )
          # TODO: install hook
          now=$(date --iso-8601=seconds)
          doc=$(echo "$line" | jq '.doc' | jq ".provisionedAt = \"$now\"")
          update_repo_doc_response=$(
            echo "$doc" | \
              curl --silent -XPUT "$COUCH/$dbname/$id" \
              -d @- \
              -H "Content-Type:application/json"
          )
          echo "{}" | jq -c "{ type: \"provision-repo\", user: \"$dbname\", repo: \"$v1\", create: \"$create_repo_response\", doc: $update_repo_doc_response }"
        fi
      fi
    fi
  fi
done
