# CouchDB Worker
The worker listens to CouchDB changes feeds and reacts on specific changes.

Technically speaking we listen to the global `_db_updates` feed (we have enabled that feature above). Whenever there is a change in one of the databases we will receive a notification containing the information which database has changed.
Now we query that database for its specific changes (and remember the update seq since we queried last time and start with that).

This is a Bash implementation, using the UNIX pipeline. The pipeline is designed to handle large amount of data fast. The bash scripts can be replaced by optimized ones one by one. I'll implement them in Rust, if I will find the time.


## Requirements
All the scripts are using

* curl
* [jq](https://stedolan.github.io/jq/)


## Global Changes Feed
The script [global-changes-feed.sh](global-changes-feed.sh) queries CouchDB for changes and outputs a JSON object to stdout.

You can run the script like this:
```sh
./global-changes-feed.sh http://admin:admin@localhost:5984
```

and it witll spit out a JSON line for each change:
```json
{"db_name":"mydb","doc":{"_id":"mydoc","_rev":"1-a61a00dff5e02add41819138aba3282d","foo":"bar"}
```


## Workers
Now that we have a global changes stream we can pass it to our workers. Currently we have two workers. They are stitched together in the pipeline, we'll come to that part above.


### Provision User Databases
Although there is the `couch_peruser` plugin we would like to provide nice urls to the user and therefore decided to implement it here on our own, since we already have the infrastructure setup at hand. For every document change in `_users` database we will create a database for that user (with appropriate permissions), named after the user. We note that down in the user document.

1. create user database
1. configure user database security
1. update user doc with `provisionedAt` timestamp

This is handled by the worker script [provision-users.sh](workers/provision-users.sh). The output of the script is again a JSON containing the individual responses for each step.


### Provision User Repositories
The user can create repository requests in their database. For each of such request, the worker will initialize an empty Git repository and configures its hook:

1. Initialize a bare repository at `/var/www/git/<username>/<reponame>.git`
2. Install the Hook to `/var/www/git/<username>/<reponame>.git/hooks/post-receive`
1. Update repo doc with `provisionedAt` stamp

Finally, the creation of the repo is noted down in the repo doc, like so:

```json
{
  "_id": "repo:my-shiny-repository",
  "requestedAt": "2020-04-01T09:37:24.405Z",
  "provisionedAt": "2020-04-01T09:37:25.290Z"
}
```

Have a look at the worker script [provision-repos.sh](workers/provision-repos.sh) to see how this is handled.


## Pipeline
Last but not least we need to wind our global changes feed and the workers together. This is done with the help of our best friend T:

```bash
./global-changes-feed.sh "$1" \
  | tee >(./workers/provision-users.sh "$1") \
  | tee >(./workers/provision-repos.sh "$1" "$2")
```

Nothing more does [couchdb-worker.sh](couchdb-worker.sh).


## Global Changes Feed Details
CouchDB itself does not provide a global changes feed. Instead, a `_db_updates` feed tells about changes in each database:

```sh
curl http://admin:admin@localhost:5984/_db_updates
```

It responds with a JSON like this:
```json
{
  "results": [
    {
      "db_name": "_users",
      "type": "updated",
      "seq": "3-g1AAAACLeJzLYWBgYMpgTmHgzcvPy09JdcjLz8gvLskBCScyJNX___..."
    }
  ]
}
```

The individual changes are then queried again against the `dbname/_changes` API:

```sh
curl http://admin:admin@localhost:5984/_users/_changes
```

and we get detailed information about that change:

```json
{
  "results": [
    {
      "seq": "2-g1AAAACHeJzLYWBgYMpgTmHgzcvPy09JdcjLz8gvLskBCScyJNX___...",
      "id": "org.couchdb.user:eva",
      "changes": [
        {
          "rev": "1-753ae0157a8b1a22339f3c0ef4f1bf19"
        }
      ],
      "doc": {
        "_id": "org.couchdb.user:eva",
        "_rev": "1-753ae0157a8b1a22339f3c0ef4f1bf19",
        "type": "user",
        "name": "eva"
      }
    }
  ]
}
```
(Note: I abbreviated the doc in this example)

The global-changes-feed script handles all that above and also manages state, that is it keeps track of the update sequence, to only query for new information.


## Docker
A [Dockerfile](Dockerfile) installs the dependencies and runs the script in a docker container.
