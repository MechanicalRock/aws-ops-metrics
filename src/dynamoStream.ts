import { CloudwatchStateChangeEvent, sortItemsByResourceId } from './common';
import { metricTimestampFromAlarmEvent } from './cloudwatchAlarmEvent';
import * as AWS from 'aws-sdk';
import { DynamoDBStreamEvent } from 'aws-lambda';
import { getDbEntryById, queryAllUnbookmaredEvents, createDbEntry } from './alarmEventStore';


if (!AWS.config.region) {
  AWS.config.region = "ap-southeast-2";
}

export interface payload {
  id: string;
  resourceId: string;
  [key: string]: any
}

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
          if (record.dynamodb.NewImage) {
            const newRecord = converter(record.dynamodb.NewImage);
            const id = newRecord.id;

            if (id.startsWith("ALARM_")) {
              const list = await queryAllUnbookmaredEvents(newRecord.pipelineName);
              const sortedList = sortItemsByResourceId(list);
              if (sortedList && sortedList.length > 0) {
                const score = await calculateTheScore(sortedList, newRecord.pipelineName);
                const payload = {
                  id: newRecord.pipelineName,
                  resourceId: `Attribute`,
                  score: score,
                  lastBookmarkedItem: `${sortedList[sortedList.length - 1].id}#${sortedList[sortedList.length - 1].resourceId}`
                }
                await createDbEntry(payload)
                // update the list with removing the bookmark key therefore removing them from GSI
                for (var i = 0; i < sortedList.length; i++) {
                  var currentItem = sortedList[i];
                  delete currentItem.bookmarked;
                  await createDbEntry(currentItem as payload);
                }
              }
            }
          }
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


async function calculateTheScore(sortedList, pipelineName: string) {
  var score = 0;
  sortedList.forEach(item => {
    score = score + item.value
  })

  const item = await getDbEntryById(pipelineName, "Attribute");
  if (item && item.score) {
    score = score + item.score
  }
  return score;
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
