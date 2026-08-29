# Static site: nginx serves the game's files directly. No build step —
# index.html, css/ and js/ are the whole application.
#
# This exists so the deploy target does not have to infer how to build the
# repo. Coolify's default build pack inspects the tree to pick a builder, and
# a bare HTML/CSS/JS folder gives it nothing to detect; a Dockerfile is
# unambiguous, and works the same on any host.
FROM nginx:alpine

COPY . /usr/share/nginx/html

EXPOSE 80
