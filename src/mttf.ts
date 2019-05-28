import { SNSEvent } from "aws-lambda";
import { CloudWatch } from "aws-sdk";

export async function handler(event: SNSEvent) {
  const cw = new CloudWatch()

  // const message = JSON.parse(event.Records[0].Sns.Message)

  await cw.putMetricData({
    MetricData: [
      {
        "MetricName": "MTTF",
        "Dimensions": [
          {
            "Name": "service",
            "Value": "foo"
          }
        ],
        "Timestamp": new Date(),
        "Value": 90,
        "Unit": "Seconds"
      }
    ],
    Namespace: "Operations"
  }).promise()

  return {}
}