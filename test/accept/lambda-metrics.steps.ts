import * as AWS from "aws-sdk-mock";
import { AlarmHistoryItem, AlarmHistoryItems } from "aws-sdk/clients/cloudwatch";
import { defineFeature, loadFeature } from "jest-cucumber";
import { handler as mtbf } from "../../src/mtbf";
import { handler as mttf } from "../../src/mttf";
import { handler as mttr } from "../../src/mttr";
import { CloudwatchStateChangeEvent } from '../../src/common';

// const AWS = require("aws-sdk-mock");

const feature = loadFeature("./features/lambda-metrics.feature");

defineFeature(feature, (test) => {

  const alarmHistory: AlarmHistoryItems = [];
  let alarmName;
  const cloudWatchSpy = jest.fn().mockReturnValue({});

  beforeEach(async () => {

    AWS.mock("CloudWatch", "putMetricData", (params, callback) => {
      callback(null, cloudWatchSpy(params));
    });

  });

  afterEach(() => {
    AWS.restore();
  });

  test("Service Fails", ({ given, when, then }) => {

    givenCloudWatchAlarmHasHistory(given);

    whenCloudWatchAlarmStateChanges(when);

    thenCloudWatchMetricShouldBeGenerated(then);

  });

  test("Service Restored", ({ given, when, then }) => {

    givenCloudWatchAlarmHasHistory(given);

    whenCloudWatchAlarmStateChanges(when);

    thenCloudWatchMetricShouldBeGenerated(then);
  });

  test("Service Fails Again", ({ given, when, then }) => {
    givenCloudWatchAlarmHasHistory(given);

    whenCloudWatchAlarmStateChanges(when);

    thenCloudWatchMetricShouldBeGenerated(then);

  });

  function givenCloudWatchAlarmHasHistory(given) {
    given(/^CloudWatch alarm "(.*)" has the following history:$/, (name, table) => {
      alarmName = name;
      const alarmHistoryResp = {
        AlarmHistoryItems: alarmHistory,
      };

      table.forEach((row) => {
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
          AlarmName: alarmName,
          HistoryData: JSON.stringify(history),
          HistorySummary: "not important",
        };

        // alarmHistory is returned in descending order
        alarmHistory.unshift(item);
      });

      AWS.mock("CloudWatch", "describeAlarmHistory", alarmHistoryResp);
    });

  }

  function whenCloudWatchAlarmStateChanges(when) {
    when(/^CloudWatch alarm state changes to (.*) at "(.*)"$/, async (newState, time) => {

      const prevState = JSON.parse(alarmHistory[alarmHistory.length - 1].HistoryData || "{}").newState.stateValue;

      const history = {
        version: "1.0",
        oldState:
        {
          stateValue: prevState,
          stateReason: "blah",
        },
        newState:
        {
          stateValue: newState,
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
        Timestamp: time,
        HistoryItemType: "StateUpdate",
        AlarmName: alarmName,
        HistoryData: JSON.stringify(history),
        HistorySummary: "not important",
      };

      // alarmHistory is returned in descending order
      alarmHistory.unshift(item);

      const alarmDetail = {
        alarmName: alarmName,
        state:
        {
          value: newState,
          reason: 'Threshold Crossed: 1 out of the last 1 datapoints [2.0 (18/11/19 07:02:00)] was greater than the threshold (0.0) (minimum 1 datapoint for OK -> ALARM transition).',
          reasonData: '{"version":"1.0","queryDate":"2019-11-18T07:03:51.700+0000","startDate":"2019-11-18T07:02:00.000+0000","statistic":"Sum","period":60,"recentDatapoints":[2.0],"threshold":0.0}',
          timestamp: time
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

      //tslint:disable
      const mockCloudwatchEvent: CloudwatchStateChangeEvent = {
        version: '0',
        id: '9f26d3d9-7edc-a164-554c-ccdc4e99b283',
        'detail-type': 'CloudWatch Alarm State Change',
        source: 'aws.cloudwatch',
        account: '516453972500',
        time: '2019-11-18T07:03:51Z',
        region: 'ap-southeast-2',
        resources:
          ['arn:aws:cloudwatch:ap-southeast-2:516453972500:alarm:flaky-service'],
        detail: alarmDetail
      };

      // simulate all the functions receiving the event
      await mttf(mockCloudwatchEvent);
      await mttr(mockCloudwatchEvent);
      await mtbf(mockCloudwatchEvent);

    });
  }

  function thenCloudWatchMetricShouldBeGenerated(then) {
    then("the following CloudWatch metric should be generated:", (docString) => {
      const expected = JSON.parse(docString);
      const expectedTsStr = expected.MetricData[0].Timestamp;
      expected.MetricData[0].Timestamp = new Date(expectedTsStr);
      expect(cloudWatchSpy).toBeCalledWith(expected);
    });
  }

});
