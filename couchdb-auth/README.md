# CouchDB Auth
Authenticate against CouchDB `_session` endpoint.

The script [couchdb-auth.sh](couchdb-auth.sh) is configured in Apache2 using an external `AuthBasicProvider`:

```conf
DefineExternalAuth couchdb environment "/usr/local/bin/couchdb-auth http://localhost:5984"

<Location "/">
  AuthType Basic
  AuthName "Ref by Rev"
  AuthBasicProvider external
  AuthExternal couchdb
  Require valid-user
</LocationMatch>
```

Username and password are passed over via environment variables. Future versions should use the more secure stdin method, though.

The script makes an authenticated query against the `_session` endpoint, like so:
```sh
curl -u "${USER}:${PASS}" http://localhost:5984/_session
```
and only if the response is a `200` the script exists with `0` which tells Apache2 a successful login attemt.

Some useful links for reference:
* https://blog.g3rt.nl/custom-http-basic-authentication-apache.html
* https://github.com/haegar/mod-auth-external/wiki/AuthHowTo 
* https://unix.stackexchange.com/questions/145571/apache-authorization-for-the-allowed-users


## Requirements
CouchDB Auth depends on curl.


## Test
You can manually run the script like so:
```sh
USER=admin PASS=admin ./couchdb-auth.sh http://localhost:5984
```


## TODO
- use stdin method instead of environment
- support session auth via COOKIE
