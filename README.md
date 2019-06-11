# lambda-metrics

Common metrics for monitoring operational health are **MTTR** (Mean Time To Recovery), **MTTF** (Mean Time To Failure), **MTBF** (Mean Time Between Failure).

![failure-metrics](./doc/img/failure-metrics.png)

*  MTBF - Mean Time Between Failure - How stable is my stuff?
*  MTTI - Mean Time To Identification - How long does it take to realise my application is on fire?
*  MTTR - Mean Time To Recovery - How long to put out the fires?
*  MTTF - Mean Time To Failure - What's my uptime like?

But how do you identify your services and generate the metrics?  One way in AWS is to use Cloud Watch Alarms.  If something is worth alerting on, it is worth capturing metrics.  The configuration of your Cloud Watch Alarms also captures logic for when you consider a failure to have occurred: an isolated error may not be considered a failure - but a few in succession indicates a problem.

This implementation uses CloudWatch Alarms history to calculate metrics.  The information contained within the history provides the context requried to calcaulate MTTR, MTTF and MTBF.  

This implementation is limited to the [14 day retention](https://aws.amazon.com/cloudwatch/faqs/) period for CloudWatch Alarms. For a longer retention period, CloudWatch Alarms History would need to be stored separately, e.g. DynamoDB

Another important metric is MTTI (Mean Time To Identification).  Depending on your definition, you could consider the triggering of the alarm to form the boundary for MTTI - the point where the failure was identified.  However, this would invalidate the definition of the other failure metrics.  A better definition for MTTI is the time from when a failure occurs to analysing the failure and understanding the root cause (and therefore the required remediation).  Since this metric is often dependent upon human analysis and context, it cannot be calculated automatically.

# WHAT

![](./doc/img/failure-metric-architecture.png)

This project uses notification actions from Cloud Watch Alarms, to trigger lambda functions to calculate, and publish, custom CloudWatch Metrics for the alarm.

Metrics are generated under the namespace `Operations`, named for the metric, e.g. `MTTF`, `MTTR`.  A metric dimension `service` is generated based on the alarm name.

# Setup

Ensure you have AWS credentials configured in `~/.aws/credentials`.  If you use `AWS_PROFILE`, please note that Serverless Framework requires these profiles to be configured in `~/.aws/credentials` also, rather than `~/.aws/config`

To use the included docker development environment
```
docker-compose run --rm dev-env
```

To build and deploy the service:
```
npm install
npm run deploy:dev
```

## Running the Example
This project also includes an example of usage containing:

* A _flaky_ lambda function, that randomly fails on execution (configured to 10% of the time)
* A CloudWatch alarm for the above function, configured to alarm on any failures and send notifications to the lambda metrics service

Ensure you have deployed the `lambda-ops-metrics` service before installing the example.
Deploy the example into the same region as `lambda-ops-metrics`

```
cd example
npm install
npm run deploy:dev
```

To run the lambda, with a random chance of failure:
```
npm run test
```

To run the lambda, ensuring a failure:
```
npm run test:failure
```

# Development


Start a new terminal:
```
docker-compose run --rm dev-env
```

Deploy the project:

```
export AWS_PROFILE=my_profile
npm install
npm run deploy:dev
```
