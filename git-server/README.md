# Git Server
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

Combining that with our [CouchDB authentication](couchdb-auth), we'll get an Apache config like so:

```conf
<VirtualHost *:80>
  # Configure git http backend
  SetEnv GIT_PROJECT_ROOT /var/www/git
  SetEnv GIT_HTTP_EXPORT_ALL
  ScriptAlias / /usr/lib/git-core/git-http-backend/
  AliasMatch ^/(.*/objects/[0-9a-f]{2}/[0-9a-f]{38})$          /var/www/git/$1
  AliasMatch ^/(.*/objects/pack/pack-[0-9a-f]{40}.(pack|idx))$ /var/www/git/$1

  <Directory "/usr/lib/git-core">
    Options +ExecCGI +SymLinksIfOwnerMatch
    Require all granted
  </Directory>

  DefineExternalAuth couchdb environment "/usr/local/bin/couchdb-auth http://localhost:5984"

  <LocationMatch "^/(?<username>[^/]+)/">
    AuthType Basic
    AuthName "Git Relax"
    AuthBasicProvider external
    AuthExternal couchdb
    Require user %{env:MATCH_USERNAME}
  </LocationMatch>
</VirtualHost>
```

Now we can serve our Git repositories via http.


## Docker
A [Dockerfile](Dockerfile) installs the dependencies, configures and runs Apache2 in a docker container.
