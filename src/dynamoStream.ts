import { CloudwatchStateChangeEvent } from './common';
import { metricTimestampFromAlarmEvent } from './cloudwatchAlarmEvent';
import * as AWS from 'aws-sdk';
import { DynamoDBStreamEvent } from 'aws-lambda';

export const handler = async (event: DynamoDBStreamEvent) => {
  console.log("stream event is: ", JSON.stringify(event));
  for (var i = 0; i < event.Records.length; i++) {
    const record = event.Records[i];

    if (!record.dynamodb || !record.dynamodb.Keys) {
      throw new Error(`Unstructured dynamo record`);
    }

    try {
      switch (record.eventName) {
        case 'MODIFY': {
          break;
        }
        case 'INSERT': {
          const converter = AWS.DynamoDB.Converter.unmarshall;
          let newRecord = record.dynamodb.NewImage ? converter(record.dynamodb.NewImage) : undefined;
          // let key = newRecord.resourceId;

          break;
        }
        case 'REMOVE': {
          break;
        }
        default:
          throw new Error(record.eventName + ' wasn\'t recognized');
      }
    } catch (e) {
      console.log(e);
      console.log("Failed to process stream record. Continuing without it");
    }
  }
  return 'Stream handling completed';
};


async function updateProductsCurrentHealth(pipelineNames, event: CloudwatchStateChangeEvent) {
  if (pipelineNames.length < 1) {
    console.log("No pipeline in the account")

    return;
  }
  const alarmName = event.detail.alarmName.toLocaleLowerCase();

  const filteredNames = pipelineNames.filter(name => {
    if (alarmName.includes(name.toLowerCase())) {
      return name;
    }
  })

  // 1. Query dynamo for current value Or I don't need that because it's always defaulted to zero?
  // what if there are no pipelines/ or they're not CNF enabled
  // 2. If null or zero? make it to 1 if Alarm, if OK make it to 0
  // 3. if there is value give it +1 if Alarm, -1 if OK
}

async function putMetrics(pipelineNames, event: CloudwatchStateChangeEvent) {
  const cw = new AWS.CloudWatch()
  if (pipelineNames.length < 1) {
    console.log("No pipeline in the account")
    return;
  }
  else {
    const filteredNames = pipelineNames.filter(name => {
      const alarmName = event.detail.alarmName.toLocaleLowerCase();
      if (alarmName.includes(name.toLowerCase())) {
        return name;
      }
    })
    // It creates the metric but Don't know why it's not adding any value
    for (var i = 0; i < filteredNames.length; i++) {
      const pipeline = filteredNames[i];
      console.log("It's a match: ", pipeline);
      const metricTime = metricTimestampFromAlarmEvent(event);
      await cw.putMetricData({
        MetricData: [
          {
            MetricName: "product-health-metric",
            Dimensions: [
              {
                Name: "product",
                Value: pipeline,
              },
            ],
            Timestamp: metricTime,
            Value: 3,
            Unit: "Count"
          },
        ],
        Namespace: "Health-Monitoring",
      }).promise();
    }
  }
}
