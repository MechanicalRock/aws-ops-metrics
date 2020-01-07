import * as AWSMock from 'aws-sdk-mock';
import { handler } from '../src/stateChangeHandler';
import { CloudwatchStateChangeEvent } from '../src/common';
import { AlarmHistoryItem, AlarmHistoryItems } from "aws-sdk/clients/cloudwatch";
import * as alarmEventStore from '../src/alarmEventStore';

describe('stateChangeCapture', () => {
  let dynamoPutSpy;
  let eventStoreSpy;
  let codePipelineSpy;
  let alarmHistory: AlarmHistoryItems;
  process.env.TABLE_NAME = "EventStore";

  beforeEach(() => {
    setup();
  });

  afterEach(() => {
    AWSMock.restore();
    eventStoreSpy.mockRestore();
  });

  it('should store the event value of -1 in dynamo when state changes from ALARM to OK', async () => {
    mockGetLastItemFromDynamo("ALARM");
    await handler(mockCloudwatchEvent);
    var expected = { "Item": { "id": "ALARM_flaky-service", "resourceId": "2019-12-12T06:25:41.200+0000", "pipelineName": "pipeline5", "bookmarked": "N", "state": "OK", "value": -1 }, "TableName": "EventStore" };
    expect(dynamoPutSpy).toBeCalledWith(expected);
  })

  it('should store the event value of 1 in dynamo when state changes from OK to ALARM', async () => {
    let alarmStateEvent: CloudwatchStateChangeEvent = { ...mockCloudwatchEvent };
    mockGetLastItemFromDynamo("OK");
    alarmStateEvent.detail.state.value = "ALARM";
    await handler(alarmStateEvent);
    var expected = { "Item": { "id": "ALARM_flaky-service", "resourceId": "2019-12-12T06:25:41.200+0000", "pipelineName": "pipeline5", "bookmarked": "N", "state": "ALARM", "value": 1 }, "TableName": "EventStore" };
    expect(dynamoPutSpy).toBeCalledWith(expected);
  })

  it('should not store the event in dynamo when state is still the same', async () => {
    mockGetLastItemFromDynamo("ALARM");
    let alarmStateEvent: CloudwatchStateChangeEvent = { ...mockCloudwatchEvent };
    alarmStateEvent.detail.state.value = "ALARM";
    await handler(alarmStateEvent);
    expect(dynamoPutSpy).not.toBeCalled();
  });

  it('should find the appropriate pipeline name when previous record does not exist in dynamo ', async () => {
    let alarmStateEvent: CloudwatchStateChangeEvent = { ...mockCloudwatchEvent };
    mockReturnEmptyItemFromDynamo();
    let items = [
      {
        date: '2019-01-01T00:02:30.000Z',
        state: 'INSUFFICIENT_DATA',
        oldSate: 'ALARM'
      },
      {
        date: '2019-01-02T00:02:30.000Z',
        state: 'ALARM',
        oldSate: 'INSUFFICIENT_DATA'
      },
      {
        date: '2019-01-03T00:02:30.000Z',
        state: 'INSUFFICIENT_DATA',
        oldSate: 'ALARM'
      },
      {
        date: '2019-01-04T00:02:30.000Z',
        state: 'OK',
        oldSate: 'INSUFFICIENT_DATA'
      }
    ]
    mockCloudwatchHistory(items);
    alarmStateEvent.detail.state.value = "OK";
    await handler(alarmStateEvent);
    expect(codePipelineSpy).toBeCalled();
    var expected = { "Item": { "id": "ALARM_flaky-service", "resourceId": "2019-12-12T06:25:41.200+0000", "pipelineName": "flaky-service-pipeline", "bookmarked": "N", "state": "OK", "value": -1 }, "TableName": "EventStore" };
    expect(dynamoPutSpy).toBeCalledWith(expected);
  })

  it('should retrieve the previouse state from cloudwatch history if there is no item in dynamo', async () => {
    let items = [
      {
        date: '2019-01-01T00:02:30.000Z',
        state: 'INSUFFICIENT_DATA',
        oldSate: 'ALARM'
      },
      {
        date: '2019-01-02T00:02:30.000Z',
        state: 'ALARM',
        oldSate: 'INSUFFICIENT_DATA'
      },
      {
        date: '2019-01-03T00:02:30.000Z',
        state: 'INSUFFICIENT_DATA',
        oldSate: 'ALARM'
      }
    ]
    mockCloudwatchHistory(items);
    mockReturnEmptyItemFromDynamo();

    let alarmStateEvent: CloudwatchStateChangeEvent = { ...mockCloudwatchEvent };
    alarmStateEvent.detail.state.value = "ALARM";
    await handler(alarmStateEvent);
    expect(codePipelineSpy).not.toBeCalled();
    expect(dynamoPutSpy).not.toBeCalled();
  });

  it('should ignore the state when it is insufficient data', async () => {
    let alarmStateEvent: CloudwatchStateChangeEvent = { ...mockCloudwatchEvent };
    alarmStateEvent.detail.state.value = "INSUFFICIENT_DATA";
    await handler(alarmStateEvent);
    expect(dynamoPutSpy).not.toBeCalled();
  })

  function setup() {
    dynamoPutSpy = jest.fn().mockReturnValue({});
    codePipelineSpy = jest.fn().mockReturnValue({
      pipelines:
        [{
          name: 'flaky-service-pipeline',
          version: 1,
          created: '2019-12-27T07:37:13.986Z',
          updated: '2019-12-27T07:37:13.986Z'
        }]
    });

    alarmHistory = [];
    eventStoreSpy = jest.spyOn(alarmEventStore, "getLastItemById");
    AWSMock.mock("DynamoDB.DocumentClient", "put", (params, callback) => {
      callback(null, dynamoPutSpy(params));
    });
    AWSMock.mock("CodePipeline", "listPipelines", (callback) => {
      callback(null, codePipelineSpy());
    });
  }

  function mockCloudwatchHistory(items) {
    const alarmHistoryResp = {
      AlarmHistoryItems: alarmHistory,
    };

    items.forEach((row) => {
      const history = {
        version: "1.0",
        oldState:
        {
          stateValue: row.oldState,
          stateReason: "blah",
        },
        newState:
        {
          stateValue: row.state,
          stateReason: "more blah",
          stateReasonData:
          {
            version: "1.0",
            queryDate: "2019-05-27T08:17:07.386+0000",
            startDate: "2019-05-27T07:57:00.000+0000",
            statistic: "Average",
            period: 300,
            recentDatapoints: [0.0, 0.0, 0.0],
            threshold: 0,
          },
        },
      };
      const item: AlarmHistoryItem = {
        Timestamp: row.date,
        HistoryItemType: "StateUpdate",
        AlarmName: "flaky-service",
        HistoryData: JSON.stringify(history),
        HistorySummary: "not important",
      };
      alarmHistory.push(item)
    });
    AWSMock.mock("CloudWatch", "describeAlarmHistory", alarmHistoryResp);
  }

  function mockGetLastItemFromDynamo(prevState: string) {
    eventStoreSpy.mockImplementation(jest.fn().mockReturnValue({
      Items:
        [{
          id: 'flaky-service',
          resourceId: '2019-12-12T06:25:41.200+0000',
          pipelineName: 'pipeline5',
          value: -1,
          state: prevState
        }],
      Count: 1,
      ScannedCount: 1,
      LastEvaluatedKey: { id: 'flaky-service', resourceId: '1577082070_pipeline8' }
    }
    ));
  }

  function mockReturnEmptyItemFromDynamo() {
    eventStoreSpy.mockImplementation(jest.fn().mockReturnValue({
      Items: [],
      Count: 0,
      ScannedCount: 0
    }));
  }

})

const alarmDetail = {
  alarmName: "flaky-service",
  state:
  {
    value: "OK",
    reason: 'Threshold Crossed: 1 out of the last 1 datapoints [2.0 (18/11/19 07:02:00)] was greater than the threshold (0.0) (minimum 1 datapoint for OK -> ALARM transition).',
    reasonData: '{"version":"1.0","queryDate":"2019-11-18T07:03:51.700+0000","startDate":"2019-11-18T07:02:00.000+0000","statistic":"Sum","period":60,"recentDatapoints":[2.0],"threshold":0.0}',
    timestamp: "2019-12-12T06:25:41.200+0000"
  },
  previousState:
  {
    value: 'INSUFFICIENT_DATA',
    reason: 'Threshold Crossed: 1 out of the last 1 datapoints [0.0 (18/11/19 06:56:00)] was not greater than the threshold (0.0) (minimum 1 datapoint for ALARM -> OK transition).',
    reasonData: '{"version":"1.0","queryDate":"2019-11-18T06:57:51.670+0000","startDate":"2019-11-18T06:56:00.000+0000","statistic":"Sum","period":60,"recentDatapoints":[0.0],"threshold":0.0}',
    timestamp: '2019-11-18T06:57:51.679+0000'
  },
  configuration:
  {
    description: 'Example alarm for a flaky service - demonstrate capturing metrics based on alarms.'
  }
}

const mockCloudwatchEvent: CloudwatchStateChangeEvent = {
  version: '0',
  id: 'abcdfgh-7edc-nmop-qrst-efghjkl',
  'detail-type': 'CloudWatch Alarm State Change',
  source: 'aws.cloudwatch',
  account: '12345',
  time: '2019-11-18T07:03:51Z',
  region: 'ap-southeast-2',
  resources:
    ['arn:aws:cloudwatch:ap-southeast-2:12345:alarm:flaky-service'],
  detail: alarmDetail
};
