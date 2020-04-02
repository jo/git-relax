FROM ubuntu:latest

RUN apt-get update && apt-get install -y curl

COPY ./couchdb-setup.sh /usr/local/bin/couchdb-setup

CMD ["/usr/local/bin/couchdb-setup", "http://admin:admin@couchdb:5984"]
