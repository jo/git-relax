# Webapp
Provide exemplary user interface for Git Relax:

* Signup & login
* Create repository requests
* Display list of repos and their status
* Display activity stream

The app listens to `<username>/_changes` feed and updates ui on changes.


## Next Steps
We could use **isomorphic-git to access and manipulate our repos** - list change log, repo contents, manipulate files with CodeMirror or ProseMirror or whatever, make commits and so on.

And we can use **PouchDB to have this completely offline**. We can even create repo requests, create the repo locally. Then, once the request has been synced and processed, we can push the local repo.

Since isomorphic-git is not good at merging atm we can further implement a **server side automatic pull request resolver**. Each client will then operate on their own branch and the worker operates on the git repo, merges that branch to master and vice versa. Conflicts are marked for user resolve and can be displayed in a webapp.

Since this is all standard technology (Apache, HTTP, Web, Git, CouchDB), we can **implement offline sync natively on almost any platform**.


## Docker
A [Dockerfile](Dockerfile), provided for convenience, installs and runs the app on a Apache2 webserver.


## Development
During development I usually just spin up a local server:
```sh
http-server webapp
```
and have my code change take effect immediately.
