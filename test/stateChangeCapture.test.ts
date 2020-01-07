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

  describe('when previous state exists', () => {

    it('should set value to -1 when alarm state changes to OK', async () => {
      await givenPreviousStateExistsInDynamo("OK", "ALARM");
      var expected = { "Item": { "id": "ALARM_flaky-service", "resourceId": "2019-12-12T06:25:41.200+0000", "pipelineName": "pipeline5", "bookmarked": "N", "state": "OK", "value": -1 }, "TableName": "EventStore" };
      expect(dynamoPutSpy).toBeCalledWith(expected);

    })

    it('should set value to 1 when alarm state changes to ALARM', async () => {
      await givenPreviousStateExistsInDynamo("ALARM", "OK");
      var expected = { "Item": { "id": "ALARM_flaky-service", "resourceId": "2019-12-12T06:25:41.200+0000", "pipelineName": "pipeline5", "bookmarked": "N", "state": "ALARM", "value": 1 }, "TableName": "EventStore" };
      expect(dynamoPutSpy).toBeCalledWith(expected);
    })

    it('should not store the event when previous and current state are both ALARM', async () => {
      await givenPreviousStateExistsInDynamo("ALARM", "ALARM");
      expect(dynamoPutSpy).not.toBeCalled();
    });

    it('should not store the event when previous and current state are both OK', async () => {
      await givenPreviousStateExistsInDynamo("OK", "OK");
      expect(dynamoPutSpy).not.toBeCalled();
    });

  })

  describe('When no previous dynamo DB record', () => {
    describe("When state changes", () => {
      it('should set value to 0 when alarm state is OK', async () => {
        await givenNoPreviousStateInDynamo("OK", "ALARM");
        var expected = { "Item": { "id": "ALARM_flaky-service", "resourceId": "2019-12-12T06:25:41.200+0000", "pipelineName": "flaky-service-pipeline", "bookmarked": "N", "state": "OK", "value": 0 }, "TableName": "EventStore" };
        expect(dynamoPutSpy).toBeCalledWith(expected);
      })

      it('should set value to 1 when alarm state is ALARM', async () => {
        await givenNoPreviousStateInDynamo("ALARM", "OK");
        var expected = { "Item": { "id": "ALARM_flaky-service", "resourceId": "2019-12-12T06:25:41.200+0000", "pipelineName": "flaky-service-pipeline", "bookmarked": "N", "state": "ALARM", "value": 1 }, "TableName": "EventStore" };
        expect(dynamoPutSpy).toBeCalledWith(expected);
      })

      it('should make api call to retrieve the pipeline name ', async () => {
        await givenNoPreviousStateInDynamo("ALARM", "OK");
        expect(codePipelineSpy).toBeCalled();
      })
    });

    describe("When state is the same", () => {
      it('should not make any api calls when current and previous states are both ALARM', async () => {
        await givenNoPreviousStateInDynamo("ALARM", "ALARM");
        expect(codePipelineSpy).not.toBeCalled();
        expect(dynamoPutSpy).not.toBeCalled();
      })
      it('should not make any api calls when current and previous states are both OK', async () => {
        await givenNoPreviousStateInDynamo("OK", "OK");
        expect(codePipelineSpy).not.toBeCalled();
        expect(dynamoPutSpy).not.toBeCalled();
      })
    })

    it('should ignore the state when it is insufficient data', async () => {
      await givenNoPreviousStateInDynamo("INSUFFICIENT_DATA", "OK");
      expect(codePipelineSpy).not.toBeCalled();
      expect(dynamoPutSpy).not.toBeCalled();
    })
  })


  async function givenNoPreviousStateInDynamo(currentState: string, prevState: string) {
    let alarmStateEvent: CloudwatchStateChangeEvent = { ...mockCloudwatchEvent };
    mockReturnEmptyItemFromDynamo();
    let items = [
      {
        date: '2019-01-02T00:02:30.000Z',
        state: prevState,
        oldSate: 'INSUFFICIENT_DATA'
      },
      {
        date: '2019-01-03T00:02:30.000Z',
        state: 'INSUFFICIENT_DATA',
        oldSate: prevState
      },
      {
        date: '2019-01-04T00:02:30.000Z',
        state: currentState,
        oldSate: 'INSUFFICIENT_DATA'
      }
    ]
    mockCloudwatchHistory(items);
    alarmStateEvent.detail.state.value = currentState;
    await handler(alarmStateEvent);
  }

  async function givenPreviousStateExistsInDynamo(currentState: string, prevState: string) {
    let alarmStateEvent: CloudwatchStateChangeEvent = { ...mockCloudwatchEvent };
    mockGetLastItemFromDynamo(prevState);
    alarmStateEvent.detail.state.value = currentState;
    await handler(alarmStateEvent);
  }

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
