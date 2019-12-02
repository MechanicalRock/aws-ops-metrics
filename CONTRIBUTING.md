# Development


Start a new terminal:
```
docker-compose run --rm dev-env
```

Deploy the project:

```
- export AWS_PROFILE=my-profile
- npm install
- npm run create-codebuild/update-codebuild
- open aws console -> codebuild service -> ops-metrics -> startbuild
```
