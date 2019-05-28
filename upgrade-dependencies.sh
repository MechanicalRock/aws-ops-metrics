#!/bin/bash

# Upgrade packages
yarn run dependency:upgrade

# Check nothing is broken
yarn run test
yarn run test:security

# Commit changes
git add package.json yarn.lock
git commit -m "[CI] - auto-upgrade dependencies"
git push

# TODO - submit pull request

# GITHUB
curl -X POST -H "Authorization: token $GITHUB_AUTH_TOKEN" -d '{"title": "CI - Auto Update Dependencies", "head": "update-dependencies", "base": "master", "body": "CI updated dependencies"}' https://api.github.com/repos/MechanicalRock/beady-eye/pulls
