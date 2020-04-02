#!/bin/bash

# Start Worker Pipeline
# - listen to global changes feed
# - pipe changes feed to provision users
# - pipe changes feed to provision repos

./global-changes-feed.sh "$1" \
  | tee >(./workers/provision-users.sh "$1") \
  | tee >(./workers/provision-repos.sh "$1" "$2")
