FROM node:12

WORKDIR /app

# install aws-cli
RUN apt-get update
RUN apt-get install -y python-pip \
  python-dev
RUN pip install awscli

ENTRYPOINT '/bin/bash'
