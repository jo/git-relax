# Git Relax
For all the gitlovers 'round here, you offline sync evangelists, text enthusiasts. This is for you.

CouchDB is the tool of choice for synchronizing structured data. But when it comes to plaintext management, nothing can beat Git. Lets have them both. And a changes feed for Git.

What we will get with Git Relax is:

* CouchDB & Git Hosting
* User Management done by CouchDB
* Per user CouchDB databases
* Multiple per user Git repositories
* Create Git repositories via HTTP PUT (create CouchDB document)
* CouchDB Changes feed for Git pushes
* CORS enabled, web ready

This project describes a minimal example setup, a proof of concept, based on standard components. For scripting, we use Bash.


## Components
Git Relax is built on top of Apache CouchDB 3.0 and Git, served via Apache2. On top of that we implement a [custom authenticator](git-server/couchdb-auth) for Apache to authenticate against CouchDB, a [Git hook](git-server/couchdb-git-hook) to publish changes to CouchDB user databases, [a worker](couchdb-worker) which manages user databases and repositories and a small webapp, which provides an exemplary user interface.

Lets walk through those components, one by one, in order of their dependencies bottom top.


### CouchDB
We gonna use latest CouchDB 3.0.

Before we can start we´ll configure the cluster, global changes feed, public signup, enable CORS and more.

See [couchdb-setup](couchdb-setup) for more information and the complete script.


### CouchDB Auth
User management is done by Couch and we want the Apache Webserver serving our Git repositories to authenticate against it.

The [couchdb-auth](git-server/couchdb-auth) script receives credentials from Apache and checks them via a query to CouchDB `/_session`.


### CouchDB Git Hook
When we push to a Git repository we create a CouchDB document in the users database. This is done by installing a Git `post-receive` hook in the users repositories.

Read [couchdb-git-hook](git-server/couchdb-git-hook) for more information.


### CouchDB Worker
This is where we connect all the things. The worker listens to CouchDB changes feeds and reacts on specific changes.

1. We listen to a global CouchDB changes feed
1. For user signups, create a user database
1. For repo documents, initialize a repository

See [couchdb-worker](couchdb-worker) for more information.


### Git Server
We serve our Git repositories via HTTP using Apache2. Authentication is done against CouchDB, see above.

Please have a look at [git-server](git-server) which contains the complete configuration.


### Webapp
A small [webapp](webapp) provides basic user interface to Git Relax.


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
