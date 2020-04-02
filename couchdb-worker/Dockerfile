FROM ubuntu:latest

RUN apt-get update && apt-get install -y \
  curl \
  jq

COPY . /opt/worker/
RUN chown -R www-data:www-data /opt/worker

USER www-data

CMD [ "/opt/worker/pipeline.sh", "http://admin:admin@couch:5984", "/var/www/git" ]
