# Git Relax
For all the gitlovers 'round here, you offline sync evangelists, text enthusiasts. This is for you.

CouchDB is the tool of choice for synchronizing structured data. But when it comes to plaintext change management, nothing can beat Git. Lets have them both. And a changes feed for Git.

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
Git Relax is built on top of Apache CouchDB 3.0 and Git, served via Apache2. On top of that we implement a **custom authenticator** for Apache to authenticate against CouchDB, a **Git hook** to publish changes to CouchDB user databases, **a worker** which manages user databases and repositories and a small webapp, which provides an exemplary user interface.


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



## API
Above we looked at the components. Here is what we get: Git Relax exposes two APIs, the Git Smart HTTP and a user and repository management HTTP API via CouchDB.

### User Management
Create users (signup), update password, login, logout and delete users.

#### Signup
a `PUT http://localhost:5984/_users/org.apache.user:eva` with the following data
```json
{
  "_id": "org.couchdb.user:eva",
  "name": "eva",
  "roles": [],
  "type": "user",
  "password": "eva"
}
```

will signup the user `eva`. Once the worker has finished, it will insert a `provisionedAt` stamp, to indicate the user database has been completely provisioned:
```json
{
  "_id": "org.couchdb.user:eva",
  "_rev": "2-89695ec69bf034daca2fd2bed4a71ce8",
  "name": "eva",
  "roles": [],
  "type": "user",
  "password_scheme": "pbkdf2",
  "iterations": 10,
  "derived_key": "f04aaa47b1533a720003b8ae0e50d0afbb8ae004",
  "salt": "4b05ca0e8d1fcbc1ac14b74e389075b5",
  "provisionedAt": "2020-04-03T10:20:18+00:00"
}
```

### Login
Now we can ask for a session cookie, via a `POST http://localhost:5984/_session`, supplying credentials:
```json
{
  "name": "eva",
  "password": "eva"
}
```

and we'l get back a cookie like this:

```
AuthSession=ZXZhOjVFODg0ODBEOvh6xalPAhvqCGWwRfvvWQfgOSif
```

Having such cookie we can get the session information with a `GET http://localhost:5984/_session`.


### Repository Management
Repositories are stored inside the user database. The user demands a repo by pushing a repository request document to her database: `PUT http://localhost:5984/eva/repo:myrepo` with data
```json
{
  "_id": "repo:myrepo",
  "requestedAt": "2020-04-01T17:40:24+02:00"
}
```

After the worker has created the repo, the document will include a `provisionedAt` stamp:
```json
{
  "_id": "repo:myrepo",
  "_rev": "2-ff197c792d754b7666529898cbcae13c",
  "requestedAt": "2020-04-01T17:40:24+02:00",
  "provisionedAt": "2020-04-01T17:40:55+02:00"
}
```

### Git Pushes
Git pushes are synced to the user database. For every push there will be a document created with information about the repo, branch and revision. This, for example, is a push to `master` branch:
```json
{
  "_id": "repo:myrepo:branch:master:ref:2fec5028e492bee6395d77107ae0debd3dd855f2",
  "_rev": "1-967a00dff5e02add41819138abb3284d",
  "receivedAt": "2020-04-01T19:12:23+02:00"
}
```


### Changes Feed
The user can listen to a changes feed on their database using the `_changes` api:
```
GET http://localhost:5984/eva/_changes
```

This feed has various options for creating a continuous update stream. See [the `/db/_changes` feed documentation](https://docs.couchdb.org/en/stable/api/database/changes.html) for detailed information.


### Git Smart HTTP
Git Repositories are available under `http://localhost:8080/eva/<repository name>.git`.


## Docker
All above has been implemented as a docker compose swarm:

* _couchdb_: runs CouchDB 3.0
* _couchdb-setup_: run setup script and exit afterwards
* _couchdb-worker_: runs the worker
* _git-server_: serves the Git repositories
* _webapp_: serves the webapp

Start it with

```sh
docker-compose up --build
```

Now you'll get the three endpoints:

* App: http://localhost:3000/
* CouchDB: http://localhost:5984/
* Git: http://localhost:8080/


Thats basically it so far. Look through the components in this repository, most of its directories contain READMEs with more detailed information. This is just the minimal setup to create a Git Relax development infrastructure and proof of concept to play with. From here on we can make up our minds about how to deploy and scale that thing, do benchmarks and optimize performance. The basics are clear and based on standards all over: Git, HTTP, UNIX Pipes, Apache2 etc. Both Git and CouchDB are decentralized from their hart, which helps us when it comes to scaling up and down, or building federal application architectures.


© 2020 Johannes J. Schmidt
