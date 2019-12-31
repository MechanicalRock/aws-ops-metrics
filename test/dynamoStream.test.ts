
import { handler } from '../src/dynamoStream';
import * as AWSMock from 'aws-sdk-mock';
import * as AWS from 'aws-sdk';
import { DynamoDBStreamEvent } from 'aws-lambda';
import * as alarmEventStore from '../src/alarmEventStore';

AWSMock.setSDKInstance(AWS);

let dynamoPutSpy;
let queryUnbookedmarkEventsSpy;
let getpipelineItemSpy;


describe('dynamoStream', () => {

  beforeEach(async () => {
    dynamoPutSpy = jest.fn().mockReturnValue({});
    queryUnbookedmarkEventsSpy = jest.spyOn(alarmEventStore, "queryAllUnbookmaredEvents");
    getpipelineItemSpy = jest.spyOn(alarmEventStore, "getDbEntryById");
    process.env.TABLE_NAME = "EventStore";
    AWSMock.mock("DynamoDB.DocumentClient", "put", (params, callback) => {
      callback(null, dynamoPutSpy(params));
    });
  });

  afterEach(() => {
    AWSMock.restore();
    queryUnbookedmarkEventsSpy.mockRestore();
  });
  describe('multiple unbookmarked items in dynamo', () => {
    it('should remove the bookmark key from the items and store them back in dynamo', async () => {
      mockReturn3UnbookedmarkedItems();
      mockReturnEmptyPipelineItem();
      await handler(dynamoMockStreamEvent);

      [
        {
          Item:
          {
            value: 1,
            id: 'ALARM_flaky-service',
            resourceId: '2019-12-30T00:47:41.171+0000',
            pipelineName: 'flaky-service-pipeline',
            state: 'Alarm'
          },
          TableName: "EventStore"
        },
        {
          Item:
          {
            value: 1,
            id: 'ALARM_flaky-service-lambda-errors',
            resourceId: '2019-12-30T01:47:41.171+0000',
            pipelineName: 'flaky-service-pipeline',
            state: 'Alarm'
          },
          TableName: "EventStore"
        },
        {
          Item:
          {
            value: -1,
            id: 'ALARM_flaky-service-lambda-errors',
            resourceId: '2019-12-30T02:47:41.171+0000',
            pipelineName: 'flaky-service-pipeline',
            state: 'OK'
          },
          TableName: "EventStore"
        }
      ].forEach(item => expect(dynamoPutSpy).toBeCalledWith(item));
    });

    it('should calculate the total score when there is a previouse score stored in dynamo', async () => {
      mockReturn3UnbookedmarkedItems();
      var previousScore = 2;
      mockgetPipelineItem(previousScore);
      await handler(dynamoMockStreamEvent);
      const expected = {
        Item:
        {
          "score": 3, "id": "flaky-service-pipeline", "lastBookmarkedItem": "ALARM_flaky-service-lambda-errors#2019-12-30T02:47:41.171+0000", "resourceId": "Attribute"
        },
        TableName: "EventStore"
      }
      expect(dynamoPutSpy).toBeCalledWith(expected);
    });

    it('should calculate the total score when there is no previouse score in dynamo', async () => {
      mockReturn3UnbookedmarkedItems();
      mockReturnEmptyPipelineItem();
      await handler(dynamoMockStreamEvent);
      const expected = {
        Item:
        {
          "score": 1, "id": "flaky-service-pipeline", "lastBookmarkedItem": "ALARM_flaky-service-lambda-errors#2019-12-30T02:47:41.171+0000", "resourceId": "Attribute"
        },
        TableName: "EventStore"
      }
      expect(dynamoPutSpy).toBeCalledWith(expected);
    });
  });

  describe('no unbookmarked items in dynamo', () => {
    it('should no store anything in dynamo when there are no unbookmarked item', async () => {
      mockReturn0UnbookedmarkedItem();
      var previousScore = 2;
      mockgetPipelineItem(previousScore);
      await handler(dynamoMockStreamEvent);
      expect(dynamoPutSpy).not.toBeCalledWith();
    });
  });

  describe('dynamo Modify/Remove events', () => {
    it('should not make any api calls when event is Modify', async () => {
      let modifyEvent: DynamoDBStreamEvent = { ...dynamoMockStreamEvent };
      modifyEvent.Records[0].eventName = "MODIFY";

      mockReturn0UnbookedmarkedItem();
      var previousScore = 2;
      mockgetPipelineItem(previousScore);
      await handler(modifyEvent);
      expect(dynamoPutSpy).not.toBeCalledWith();
      expect(queryUnbookedmarkEventsSpy).not.toBeCalledWith();
      expect(getpipelineItemSpy).not.toBeCalledWith();
    });

    it('should not make any api calls when event is Remove', async () => {
      let removeEvent: DynamoDBStreamEvent = { ...dynamoMockStreamEvent };
      removeEvent.Records[0].eventName = "REMOVE";

      mockReturn0UnbookedmarkedItem();
      var previousScore = 2;
      mockgetPipelineItem(previousScore);
      await handler(removeEvent);
      expect(dynamoPutSpy).not.toBeCalledWith();
      expect(queryUnbookedmarkEventsSpy).not.toBeCalledWith();
      expect(getpipelineItemSpy).not.toBeCalledWith();
    });
  });
});

function mockgetPipelineItem(previousScore: number) {
  getpipelineItemSpy.mockImplementation(jest.fn().mockReturnValue(
    { "score": previousScore, "id": "flaky-service-pipeline", "lastBookmarkedItem": "ALARM_flaky-service-lambda-errors#2019-12-30T02:47:41.171+0000", "resourceId": "Attribute" }
  ));
}

function mockReturnEmptyPipelineItem() {
  getpipelineItemSpy.mockImplementation(jest.fn().mockReturnValue({}));
}

function mockReturn3UnbookedmarkedItems() {
  queryUnbookedmarkEventsSpy.mockImplementation(jest.fn().mockReturnValue({
    Items: [{
      value: 1,
      bookmarked: "N",
      id: "ALARM_flaky-service",
      resourceId: "2019-12-30T00:47:41.171+0000",
      pipelineName: "flaky-service-pipeline",
      state: "Alarm"
    },
    {
      value: 1,
      bookmarked: "N",
      id: "ALARM_flaky-service-lambda-errors",
      resourceId: "2019-12-30T01:47:41.171+0000",
      pipelineName: "flaky-service-pipeline",
      state: "Alarm"
    },
    {
      value: -1,
      bookmarked: "N",
      id: "ALARM_flaky-service-lambda-errors",
      resourceId: "2019-12-30T02:47:41.171+0000",
      pipelineName: "flaky-service-pipeline",
      state: "OK"
    }],
    Count: 3,
    ScannedCount: 3
  }));
}

function mockReturn0UnbookedmarkedItem() {
  queryUnbookedmarkEventsSpy.mockImplementation(jest.fn().mockReturnValue({
    Items: [],
    Count: 0,
    ScannedCount: 0
  }));
}

const dynamoMockStreamEvent: DynamoDBStreamEvent = {
  "Records": [
    {
      "eventID": "123456789",
      "eventName": 'INSERT',
      "eventVersion": "1.1",
      "eventSource": "aws:dynamodb",
      "awsRegion": "ap-southeast-2",
      "dynamodb": {
        "ApproximateCreationDateTime": 1570668037,
        "Keys": {
          "resourceId": {
            "S": "1570668036460"
          },
          "id": {
            "S": "ALARM_Flaky-service"
          }
        },
        "NewImage": {
          "resourceId": {
            "S": "1570668036460"
          },
          "pipelineName": {
            "S": "flaky-service-pipeline"
          },
          "id": {
            "S": "ALARM_Flaky-service"
          },
          "bookmarked": {
            "BOOL": false
          },
          "state": {
            "S": "ALARM"
          },
          "value": {
            "N": "1"
          }
        },
        "SequenceNumber": "12345678901356",
        "SizeBytes": 1007
      },
      "eventSourceARN": "arn:aws:dynamodb:ap-southeast-2:123456:table/EventStore/stream/2019-10-09T07:19:23.105"
    }
  ]
};
