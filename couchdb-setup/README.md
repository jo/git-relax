# Setup CouchDB
Provision a new CouchDB server.

The script [couchdb-setup.sh](couchdb-setup.sh) runs several idempotent curl commands against CouchDB.

1. Wait for CouchDB to be ready by querying welcome endpoint in a loop
1. Setup the cluster as single node, usind `_cluster_setup` API
1. Enable global changes feed and creating the `_global_changes` database
1. Configure `_users` db security object (and enable it in config) to make public signup possible
1. Enable and configure CORS
1. Increase session timeout

For example, to configure the global changes feed, we issue curl request like this:
```bash
curl -XPUT --silent "$COUCHDB_URL/_global_changes"
curl -XPUT --silent "$COUCHDB_URL/_node/nonode@nohost/_config/global_changes/update_db" -d '"true"'
```

## Dependencies
Setup CouchDB depends on curl.


## Test
You can manually run the script like so:
```sh
./couchdb-setup.sh http://admin:admin@localhost:5984
```


## TODO: Username Validation
Since we use usernames as database names as well as for Git directory names we will need to strengthen username validation. This will be done by creating another design document in the `_users` database with a validation doc function like this:
```js
function (newDoc, oldDoc, userCtx, secObj) {
  if (!newDoc.name.match(/^[a-z]{3,32}$/)) {
    throw({ forbidden: 'doc.name must consist of 3-32 lowercase letters a-z.' })
  }
}
```


## Docker
A [Dockerfile](Dockerfile) installs dependencies, runs the script in a docker container and exists afterwards.
