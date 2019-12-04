Feature: Lambda Metrics

  Rules:
  - Metric calculations:
  - MTBF - Mean Time Between Failure
  Time between 2 failure states

  - MTTR - Mean Time To Recovery
  Time from failure state to healthy (when previous state was ALARM)

  MTTF - Mean Time To Failure - What's my uptime like?
  Time from healthy state to failure
  - Metrics are calculated in seconds
  - Dimensions:
  - service name (based on alarm)

  Scenario: Service Fails
    Given CloudWatch alarm "foo" has the following history:
      | date                     | state | oldSate           |
      | 2019-01-01T00:00:00.000Z | OK    | INSUFFICIENT_DATA |
    When CloudWatch alarm state changes to ALARM at "2019-01-01T00:01:30.000Z"
    Then the following CloudWatch metric should be generated:
      """
      {
        "MetricData": [
          {
            "MetricName": "MTTF",
            "Dimensions": [
              {
                "Name": "service",
                "Value": "foo"
              }
            ],
            "Timestamp": "2019-01-01T00:01:30.000Z",
            "Value": 90,
            "Unit": "Seconds"
          }
        ],
        "Namespace": "Operations"
      }
      """

  Scenario: Service Restored
    Given CloudWatch alarm "foo" has the following history:
      | date                     | state | oldSate           |
      | 2019-01-01T00:01:30.000Z | ALARM | OK                |
      | 2019-01-01T00:00:00.000Z | OK    | INSUFFICIENT_DATA |
    When CloudWatch alarm state changes to OK at "2019-01-01T01:01:30.000Z"
    Then the following CloudWatch metric should be generated:
      """
      {
        "MetricData": [
          {
            "MetricName": "MTTR",
            "Dimensions": [
              {
                "Name": "service",
                "Value": "foo"
              }
            ],
            "Timestamp": "2019-01-01T01:01:30.000Z",
            "Value": 3600,
            "Unit": "Seconds"
          }
        ],
        "Namespace": "Operations"
      }
      """

  Scenario: Service is still healthy
    Given CloudWatch alarm "foo" has the following history:
      | date                     | state             | oldSate           |
      | 2019-01-01T02:01:30.000Z | INSUFFICIENT_DATA | OK                |
      | 2019-01-01T01:01:30.000Z | OK                | ALARM             |
      | 2019-01-01T00:01:30.000Z | ALARM             | INSUFFICIENT_DATA |
    When CloudWatch alarm state changes to OK at "2019-01-01T02:01:30.000Z"
    Then It should not generate any metrics

  Scenario: Service Fails Again
    Given CloudWatch alarm "foo" has the following history:
      | date                     | state | oldSate           |
      | 2019-01-01T01:01:30.000Z | OK    | ALARM             |
      | 2019-01-01T00:01:30.000Z | ALARM | INSUFFICIENT_DATA |
    When CloudWatch alarm state changes to ALARM at "2019-01-01T02:01:30.000Z"
    Then the following CloudWatch metric should be generated:
      """
      {
        "MetricData": [
          {
            "MetricName": "MTBF",
            "Dimensions": [
              {
                "Name": "service",
                "Value": "foo"
              }
            ],
            "Timestamp": "2019-01-01T02:01:30.000Z",
            "Value": 7200,
            "Unit": "Seconds"
          }
        ],
        "Namespace": "Operations"
      }
      """
