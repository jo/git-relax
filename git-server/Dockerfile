FROM ubuntu:focal

RUN apt-get update && DEBIAN_FRONTEND=noninteractive TZ=Etc/UTC apt-get install -y \
  apache2 \
  libapache2-mod-authnz-external \
  curl \
  git-core

RUN a2enmod cgi

COPY ./000-default.conf /etc/apache2/sites-available/000-default.conf
RUN sed -i -e 's/localhost:5984/couchdb:5984/' /etc/apache2/sites-available/000-default.conf

COPY ./couchdb-auth/couchdb-auth.sh /usr/local/bin/couchdb-auth
RUN chmod +x /usr/local/bin/couchdb-auth

COPY ./couchdb-git-hook/couchdb-git-hook.sh /usr/local/bin/couchdb-git-hook
RUN sed -i -e 's/localhost:5984/couchdb:5984/' /usr/local/bin/couchdb-git-hook
RUN chmod +x /usr/local/bin/couchdb-git-hook

RUN mkdir -p /var/www/git/
RUN chown www-data:www-data -R /var/www/git/

EXPOSE 80

CMD ["/usr/sbin/apache2ctl", "-DFOREGROUND"]
