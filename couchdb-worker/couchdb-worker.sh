#!/bin/bash

# Start Worker Pipeline
# - listen to global changes feed
# - pipe changes feed to provision users
# - pipe changes feed to provision repos

script_path=$(dirname "$0")

$script_path/global-changes-feed.sh "$1" \
  | tee >($script_path/workers/provision-users.sh "$1") \
  | tee >($script_path/workers/provision-repos.sh "$1" "$2")
