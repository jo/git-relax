# Ref by Rev
For all the #GitOps lovers round here, for offline sync evangelists, for text enthusiasts. This is for you. CouchDB is the tool of choice for synchronizing structured data. But when it comes to plaintext management, nothing can beat Git. Lets have them both. And a changes feed for Git.

This is a minimal example setup, a proof of concept, based on standard components.


## Components

1. Apache CouchDB 3.0
1. External authenticator for Apache 2 which queries couch session
1. A Git hook to push changes to the couch
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

```bash
COUCH=http://admin:admin@localhost:5984

echo "waiting for CouchDB to come up"
until $(curl --output /dev/null --silent --head --fail $COUCH); do
    printf '.'
    sleep 1
done

echo "cluster setup"
curl -XPOST --silent $COUCH/_cluster_setup \
  -d '{"action":"enable_single_node","username":"admin","password":"admin","bind_address":"0.0.0.0","port":5984,"singlenode":true}' \
  -H 'Content-Type:application/json'

echo "configure global changes feed"
curl -XPUT --silent $COUCH/_global_changes
curl -Xput --silent $COUCH/_node/nonode@nohost/_config/global_changes/update_db -d '"true"'

echo "configure _users db for public signup"
curl -XPUT --silent $COUCH/_node/nonode@nohost/_config/couchdb/users_db_security_editable -d '"true"'
curl -XPUT --silent $COUCH/_users/_security -d '{}'

echo "configure CORS"
curl -XPUT --silent $COUCH/_node/nonode@nohost/_config/httpd/enable_cors -d '"true"'
curl -XPUT --silent $COUCH/_node/nonode@nohost/_config/cors/origins -d '"*"'
curl -XPUT --silent $COUCH/_node/nonode@nohost/_config/cors/credentials -d '"true"'
curl -XPUT --silent $COUCH/_node/nonode@nohost/_config/cors/methods -d '"GET, PUT, POST, HEAD, DELETE"'
curl -XPUT --silent $COUCH/_node/nonode@nohost/_config/cors/headers -d '"accept, authorization, content-type, origin, referer, x-csrf-token"'

echo "configure session timeout"
curl -XPUT --silent $COUCH/_node/nonode@nohost/_config/couch_httpd_auth/timeout -d '"86400"'
```


## Authenticator
User management is done by Couch and we want the Apache Webserver serving our Git repositories to authenticate against it.

Apache2 offers the possibility to authenticate using a custom script:

```conf
DefineExternalAuth couch_auth environment /usr/local/bin/couchdb-auth.sh

<Location "/">
  AuthType Basic
  AuthName "Ref by Rev"
  AuthBasicProvider external
  AuthExternal couch_auth
  Require valid-user
</LocationMatch>
```
  
#### `/usr/local/bin/couchdb-auth.sh`:
Make basic auth query against CouchDB's `/_session` endpoint. Only if response code is 200 you are authorized and the script exists with `0`.

```bash
#!/bin/bash
status_code=$(curl --write-out %{http_code} --silent --output /dev/null -u "${USER}:${PASS}" http://localhost:5984/_session)

echo "[notice] $(date) authenticating ${USER}: ${status_code}"

if [[ "$status_code" -ne 200 ]] ; then
  exit 1
else
  exit 0
fi
```

See for reference:
* https://blog.g3rt.nl/custom-http-basic-authentication-apache.html
* https://github.com/haegar/mod-auth-external/wiki/AuthHowTo 
* https://unix.stackexchange.com/questions/145571/apache-authorization-for-the-allowed-users


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

We handle two things atm:
* create user databases
* create repositories

### Create User Database
Although there is the `couch_peruser` plugin we would like to provide nice urls to the user and therefore decided to implement it here on our own, since we already have the infrastructure setup at hand. For every document change in `_users` database we will create a database for that user (with appropriate permissions), named after the user. We note that down in the user document.

### Create Repository
The user can create repo requests in their database:
```json
{
  "_id": "repo:my-shiny-repository",
  "requested": "2020-04-01T09:37:24.405Z"
}
```
The worker listens for those document changes and create the repo accordingly.

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
  ServerName refbyrev.com
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



© 2020 Johannes J. Schmidt
