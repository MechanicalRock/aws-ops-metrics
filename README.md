# lambda-metrics

Generate MTTR, MTTF, MTBF metrics for lambda functions.

This implementation uses CloudWatch Alarms history to calculate metrics.

This implementation is limited to the [14 day retention](https://aws.amazon.com/cloudwatch/faqs/) period for CloudWatch Alarms. For a longer retention period, CloudWatch Alarms History would need to be stored separately, e.g. DynamoDB


# WHAT

TODO - What does the project do?

# Setup

TODO - detail setup steps here

# Development

In one terminal shell:

```
docker-compose run --rm dev-env-aws
bash-4.3# ./assumeRole.sh
```

Copy the output (example):

```
export AWS_DEFAULT_REGION=ap-southeast-2
export AWS_ACCESS_KEY_ID='SAMPLE'
export AWS_ACCESS_KEY='SAMPLE'
export AWS_SECRET_ACCESS_KEY='SAMPLE'
export AWS_SECRET_KEY='SAMPLE'
export AWS_SESSION_TOKEN='SAMPLE'
export AWS_SECURITY_TOKEN='SAMPLE'
export AWS_DELEGATION_TOKEN='SAMPLE'
```

Start a new terminal:
```
docker-compose run --rm dev-env
```

Paste the export commands from above

Deploy the project:

```
node_modules/.bin/serverless deploy
```
