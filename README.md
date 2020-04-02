# Git Relax
For all the gitlovers 'round here, you offline sync evangelists, text enthusiasts. This is for you.

CouchDB is the tool of choice for synchronizing structured data. But when it comes to plaintext management, nothing can beat Git. Lets have them both. And a changes feed for Git.

What we will get after following this article is:

* CouchDB & Git Hosting
* User Management done by CouchDB
* Per user CouchDB databases
* Multiple per user Git repositories
* Create Git repositories via HTTP PUT (create CouchDB document)
* CouchDB Changes feed for Git pushes
* CORS enabled, web ready

This article describes a minimal example setup, a proof of concept, based on standard components:


## Components

1. Apache CouchDB 3.0
1. External authenticator for Apache 2 (against CouchDB `_session` API)
1. A Git hook to push changes to user CouchDB database
1. A worker listening to changes feed: create user databases and repositories and installs hooks
1. Git Webserver: Apache 2 with smart Git HTTP protocol using above authenticator
1. An example webapp for managing repositories and displaying the activity stream

Lets walk through them, one by one, in order of their dependencies bottom top.


## CouchDB
We gonna use latest CouchDB 3.0.

Before we can start we´ll configure some stuff using curl:

* wait for couch to be ready
* cluster setup (single node)
* global changes feed (enable)
* `_users` db (public signup)
* enable CORS
* session timeout (higher)

For example, to configure the global changes feed:
```bash
curl -XPUT --silent "$COUCHDB_URL/_global_changes"
curl -XPUT --silent "$COUCHDB_URL/_node/nonode@nohost/_config/global_changes/update_db" -d '"true"'
```

See [couchdb-setup](couchdb-setup) for more information and the complete script.


## Authenticator
User management is done by Couch and we want the Apache Webserver serving our Git repositories to authenticate against it.

Apache2 offers the possibility to authenticate using a custom external script:

```conf
DefineExternalAuth couch_auth environment "/usr/local/bin/couchdb-auth http://localhost:5984"
```

The [couchdb-auth](couchdb-auth) script receives credentials from Apache and checks them via a query to CouchDB `/_session`.


## Hook
When we push to a Git repository we create a CouchDB document in the users database. This is done by installing a Git `post-receive` hook, which calls the following script:

```bash
repofilename=$(pwd)

reponame=$(basename $repofilename '.git')
repodirname=$(dirname $repofilename)
username=$(basename $repodirname)

# read receive ref info from stdin:
# `<old-value> SP <new-value> SP <ref-name> LF`
# 0000000000000000000000000000000000000000 f2a4dfdcbb970b22aca260144ac294c31a41a832 refs/heads/master
# 0000000000000000000000000000000000000000 f2a4dfdcbb970b22aca260144ac294c31a41a832 refs/heads/mybranch
while read line
do
  previous=$(echo "$line" | cut -d " " -f1)
  current=$(echo "$line" | cut -d " " -f2)
  ref=$(echo "$line" | cut -d " " -f3)
  branchname=$(basename "$ref")

  id="repo:$reponame:branch:$branchname:ref:$current"

  payload="{\"_id\":\"$id\"}"

  # TODO: use credentials hopefully (or not hähä) available as environment variable, or the cookie
  curl -s -XPOST "http://admin:admin@localhost:5984/$username" -d "$payload" -H 'Content-Type:application/json'
done < /dev/stdin
```

We receive information about received refs via stdin and create a document in the Couch containing that information.


## Worker
This is where we connect all the things. The worker listens to CouchDB changes feeds and react on specific changes.

Technically speaking we listen to the global `_db_updates` feed (we have enabled that feature above). Whenever there is a change in one of the databases we will receive a notification containing the information which database has changed.
Now we query that database for its specific changes (and remember the update seq since we queried last time and start with that).

This is a Bash implementation, which streams changes to stdout:

#### `global-changes-feed.sh`
```bash
#!/bin/bash

# CouchDB global changes feed
# outputs a JSON line like `{ "db_name": "mydb", "doc": { "_id": "doc_id" } }` for each change

# Requirements:
# * curl
# * jq

COUCH=$1

declare -A update_seqs_per_db

>&2 echo "Listening to changes on $COUCH. Press [CTRL+C] to stop.."

while :
do
  if [ $last_seq ]
  then
    db_updates=$(curl --silent "$COUCH/_db_updates?feed=longpoll&since=$last_seq")
  else
    db_updates=$(curl --silent "$COUCH/_db_updates?feed=longpoll")
  fi

  last_seq=$(echo "$db_updates" | jq -r '.last_seq')
  db_changes=$(echo "$db_updates" | jq -c '.results[]')

  for db_change in $db_changes ; do
    dbname=$(echo "$db_change" | jq -r '.db_name')
    if [ "$dbname" != "_dbs" ]
    then
      since=${update_seqs_per_db[$dbname]}
      if [ $since ]
      then
        changes=$(curl --silent "$COUCH/$dbname/_changes?include_docs=true&since=$since}")
      else
        changes=$(curl --silent "$COUCH/$dbname/_changes?include_docs=true")
      fi
      update_seqs_per_db["$dbname"]=$(echo "$changes" | jq -r '.last_seq')

      # build change object with db name and filter out design documents
      echo "$changes" \
        | jq -c "{ db_name: \"$dbname\", doc: .results[].doc }" \
        | jq -c 'select( .doc._id | contains("_design/") | not)'
    fi
  done
done
```

We handle two things atm:
* create user databases
* create repositories

We can setup a pipeline for procesing:
```bash
./global-changes-feed.sh "$1" \
  | tee >(./workers/provision-users.sh "$1") \
  | tee >(./workers/provision-repos.sh "$1" "$2")
```

### Create User Database
Although there is the `couch_peruser` plugin we would like to provide nice urls to the user and therefore decided to implement it here on our own, since we already have the infrastructure setup at hand. For every document change in `_users` database we will create a database for that user (with appropriate permissions), named after the user. We note that down in the user document.

This is a bash script implementing a user provisioning worker:

#### `workers/provision-users.sh`
```bash
#!/bin/bash

# Provision Users
# - create user database
# - configure user database security
# - update user doc with `provisionedAt` timestamp

COUCH=$1

>&2 echo "Creating user dbs on $COUCH.."

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
        create_db_response=$(curl --silent -XPUT "$COUCH/$username")
        update_security_response=$(
          curl --silent -XPUT "$COUCH/$username/_security" \
            -d "{\"members\":{\"roles\":[\"_admin\"],\"names\":[\"$username\"]},\"admins\":{\"roles\":[\"_admin\"],\"names\":[\"$username\"]}}" \
            -H "Content-Type:application/json")
        now=$(date --iso-8601=seconds)
        doc=$(echo "$line" | jq '.doc' | jq ".provisionedAt = \"$now\"")
        update_user_doc_response=$(
          echo "$doc" | \
            curl --silent -XPUT "$COUCH/_users/org.couchdb.user:$username" \
            -d @- \
            -H "Content-Type:application/json"
        )
        echo "{}" | jq -c "{ type: \"provision-user\", user: \"$username\", create: $create_db_response, security: $update_security_response, doc: $update_user_doc_response }"
      fi
    fi
  fi
done
```

### Create Repository
The user can create repo requests in their database:
```json
{
  "_id": "repo:my-shiny-repository",
  "requested": "2020-04-01T09:37:24.405Z"
}
```
The worker listens for those document changes and create the repo accordingly.

#### `workers/provision-repos.sh`
```bash
#!/bin/bash

# Provision Repos
# - create repository
# - setup hook
# - update repo doc with `created` stamp

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
```

Whats missing in the script above atm is the hook installation routine.

1. Initialize a bare repository at `/var/www/git/<username>/<reponame>.git`
2. Install the Hook to `/var/www/git/<username>/<reponame>.git/hooks/post-receive`

The hook forwards to global installed CouchDB post-receive hook:

```bash
#!/bin/bash
couchdb-post-receive.sh <&0
```

Finally, the creation of the repo is noted down in the repo doc, like so:

```json
{
  "_id": "repo:my-shiny-repository",
  "requested": "2020-04-01T09:37:24.405Z",
  "created": "2020-04-01T09:37:25.290Z"
}
```

## Gitserver
Git comes with a CGI script to serve a repo over http. See https://git-scm.com/book/pl/v2/Git-on-the-Server-Smart-HTTP.

```conf
SetEnv GIT_PROJECT_ROOT /var/www/git
SetEnv GIT_HTTP_EXPORT_ALL
ScriptAlias / /usr/lib/git-core/git-http-backend/
<Directory "/usr/lib/git-core">
  Options +ExecCGI +SymLinksIfOwnerMatch
  Require all granted
</Directory>
```

We finally restrict access to the users Git home:

```conf
<LocationMatch "^/(?<username>[^/]+)/">
  Require user %{env:MATCH_USERNAME}
</LocationMatch>
```

Combining that with our CouchDB authentication, we'll get a Apache config like so:

```conf
<VirtualHost *:80>
  ServerAdmin webmaster@localhost
  DocumentRoot /var/www/html
  ErrorLog ${APACHE_LOG_DIR}/error.log
  CustomLog ${APACHE_LOG_DIR}/access.log combined

  # Configure git http backend
  SetEnv GIT_PROJECT_ROOT /var/www/git
  SetEnv GIT_HTTP_EXPORT_ALL
  ScriptAlias / /usr/lib/git-core/git-http-backend/

  # Accelerated static Apache 2.x
  # Similar to the above, but Apache can be used to return static files that
  # are stored on disk. On many systems this may be more efficient as Apache
  # can ask the kernel to copy the file contents from the file system
  # directly to the network:
  AliasMatch ^/(.*/objects/[0-9a-f]{2}/[0-9a-f]{38})$          /var/www/git/$1
  AliasMatch ^/(.*/objects/pack/pack-[0-9a-f]{40}.(pack|idx))$ /var/www/git/$1

  <Directory "/usr/lib/git-core">
    Options +ExecCGI +SymLinksIfOwnerMatch
    Require all granted
  </Directory>

  # Authenticate against CouchDB
  DefineExternalAuth couch_auth environment /usr/local/bin/couchdb-auth.sh

  <LocationMatch "^/(?<username>[^/]+)/">
    AuthType Basic
    AuthName "Ref by Rev"
    AuthBasicProvider external
    AuthExternal couch_auth
    Require user %{env:MATCH_USERNAME}
  </LocationMatch>
</VirtualHost>
```

Now we can serve our Git repositories via http.


## Webapp
Last but not least we can create a webapp which interacts with our system.

* signup & login
* listen to `<username>/_changes` feed and update ui on changes
* create repository requests
* display list of repos and their status
* display activity stream

Finally, we'll use **isomorphic-git to access and manipulate our repos** - list change log, repo contents, manipulate files with CodeMirror or ProseMirror or whatever, make commits and so on.

And we can use **PouchDB to have this completely offline**. We can even create repo requests, create the repo locally. Then, once the request has been synced and processed, we can push the local repo.

Since isomorphic-git is not good at merging atm we can further implement a **server side automatic pull request resolver**. Each client will then operate on their own branch and the worker operates on the git repo, merges that branch to master and vice versa. Conflicts are marked for user resolve and can be displayed in a webapp.

Since this is all standard technology (Apache, HTTP, Web, Git, CouchDB), we can **implement offline sync natively on almost any platform**.


## Documents

The user demands a repo by pushing such document to her database:
```json
{
  "_id": "repo:myrepo",
  "_rev": "3-ff197c792d754b7666529898cbcae13c"
}
```

After the worker has created the repo, the document will look like this:
```json
{
  "_id": "repo:myrepo",
  "_rev": "3-ff197c792d754b7666529898cbcae13c",
  "provisionedAt": "2020-04-01T17:40:55+02:00"
}
```

This is a push to `master` branch:
```json
{
  "_id": "repo:myrepo:branch:master:ref:2fec5028e492bee6395d77107ae0debd3dd855f2",
  "_rev": "1-967a00dff5e02add41819138abb3284d"
}
```

And this a push to `mybranch`:
```json
{
  "_id": "repo:myrepo:branch:mybranch:ref:6147b545c5c21473dbd4327fcf4121b99fe4dcd2",
  "_rev": "1-967a00dff5e02add41819138abb3284d"
}
```


## Docker
Above has been implemented as a docker compose swarm. Start it with

```sh
	docker-compose up --build
```

Now you'll get three endpoints:

* App: http://localhost:3000/
* CouchDB: http://localhost:5984/
* Git: http://localhost:8080/


## AWS EC2 Image
I plan to provide Terraform and Ansible playbooks for orchestrating and provisioning an AWS EC2 instance. Maybe I could also provide ready to go images - is this possible?


© 2020 Johannes J. Schmidt
