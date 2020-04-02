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

This project describes a minimal example setup, a proof of concept, based on standard components:


## Components

1. Apache CouchDB 3.0
1. External authenticator for Apache 2 (against CouchDB `_session` API)
1. A Git hook to push changes to user CouchDB database
1. A worker listening to changes feed: create user databases and repositories and installs hooks
1. Git Webserver: Apache 2 with smart Git HTTP protocol using above authenticator
1. An example webapp for managing repositories and displaying the activity stream

Lets walk through them, one by one, in order of their dependencies bottom top.


### CouchDB
We gonna use latest CouchDB 3.0.

Before we can start we´ll configure the cluster, global changes feed, public signup, enable CORS and more.

For example, to configure the global changes feed:
```bash
curl -XPUT --silent "$COUCHDB_URL/_global_changes"
curl -XPUT --silent "$COUCHDB_URL/_node/nonode@nohost/_config/global_changes/update_db" -d '"true"'
```

See [couchdb-setup](couchdb-setup) for more information and the complete script.


### CouchDB Auth
User management is done by Couch and we want the Apache Webserver serving our Git repositories to authenticate against it.

Apache2 offers the possibility to authenticate using a custom external script:

```conf
DefineExternalAuth couch_auth environment "/usr/local/bin/couchdb-auth http://localhost:5984"
```

The [couchdb-auth](couchdb-auth) script receives credentials from Apache and checks them via a query to CouchDB `/_session`.


### CouchDB Git Hook
When we push to a Git repository we create a CouchDB document in the users database. This is done by installing a Git `post-receive` hook in the users repositories.

Read [couchdb-git-hook](couchdb-git-hook) for more information.


### CouchDB Worker
This is where we connect all the things. The worker listens to CouchDB changes feeds and reacts on specific changes.

1. We listen to a global CouchDB changes feed
1. For user signups, create a user database
1. For repo documents, initialize a repository

See [couchdb-worker](couchdb-worker) for more information.


### Git Server
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


### Webapp
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
