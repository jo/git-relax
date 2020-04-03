FROM ubuntu:latest

RUN apt-get update && apt-get install -y \
  git-core \
  curl \
  jq

COPY ./ /opt/couchdb-worker/
RUN chown -R www-data:www-data /opt/couchdb-worker

USER www-data

CMD [ "/opt/couchdb-worker/couchdb-worker.sh", "http://admin:admin@couchdb:5984", "/var/www/git" ]
