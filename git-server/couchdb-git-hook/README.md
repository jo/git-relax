# CouchDB Git Hook
This hook is installed on user repositories as a `post-receive` hook. The hooks receives information about pushed refs via stdin, like this:

```
# `<old-value> SP <new-value> SP <ref-name> LF`
# 0000000000000000000000000000000000000000 f2a4dfdcbb970b22aca260144ac294c31a41a832 refs/heads/master
# 0000000000000000000000000000000000000000 6147b545c5c21473dbd4327fcf4121b99fe4dcd2 refs/heads/mybranch
```

See https://git-scm.com/docs/githooks#post-receive for reference.

After each receive event, it creates a CouchDB document in the users database. This is a push to `master` branch:
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

The hook can either be copied over or symlinked into each user repository, or called like this:
```
#!/bin/bash
/usr/local/bin/couchdb-git-hook <&0
```

## TODO:
Currently the CouchDB url is hardcoded. We should find a uniform way how to handle such configuration.


## Testing
You can invoke an test the script manually like so:
```sh
echo "0000000000000000000000000000000000000000 f2a4dfdcbb970b22aca260144ac294c31a41a832 refs/heads/master" | ./couchdb-git-hook.sh
```
