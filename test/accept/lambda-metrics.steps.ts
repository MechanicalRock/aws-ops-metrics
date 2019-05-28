import { defineFeature, loadFeature } from 'jest-cucumber';
import { AlarmHistoryItems, AlarmHistoryItem } from 'aws-sdk/clients/cloudwatch';
import { handler as mttf } from '../../src/mttf'
import { handler as mttr } from '../../src/mttr'
import { handler as mtbf } from '../../src/mtbf'
import { CloudWatchAlarmNotificationMessage } from '../../src/cloudwatchAlarmSnsEvent';

var AWS = require('aws-sdk-mock');

const feature = loadFeature('./features/lambda-metrics.feature');

defineFeature(feature, test => {


  var alarmHistory: AlarmHistoryItems = []
  let alarmName;
  let cloudWatchSpy = jest.fn().mockReturnValue({})

  beforeEach(async () => {

    AWS.mock('CloudWatch', 'putMetricData', (params, callback) => {
      callback(null, cloudWatchSpy(params))
    });

  })

  afterEach(() => {
    AWS.restore()
  })

  test('Service Fails', ({ given, when, then }) => {

    givenCloudWatchAlarmHasHistory(given)

    whenCloudWatchAlarmStateChanges(when)

    thenCloudWatchMetricShouldBeGenerated(then)

  });

  test('Service Restored', ({ given, when, then }) => {

    givenCloudWatchAlarmHasHistory(given)

    whenCloudWatchAlarmStateChanges(when)

    thenCloudWatchMetricShouldBeGenerated(then)
  });

  test('Service Fails Again', ({ given, when, then }) => {
    givenCloudWatchAlarmHasHistory(given)

    whenCloudWatchAlarmStateChanges(when)

    thenCloudWatchMetricShouldBeGenerated(then)

  });

  function givenCloudWatchAlarmHasHistory(given) {
    given(/^CloudWatch alarm "(.*)" has the following history:$/, (name, table) => {
      alarmName = name
      var alarmHistoryResp = {
        AlarmHistoryItems: alarmHistory
      }


      table.forEach(row => {
        const history = {
          version: '1.0',
          oldState:
          {
            stateValue: row.oldState,
            stateReason: 'blah'
          },
          newState:
          {
            stateValue: row.state,
            stateReason: 'more blah',
            stateReasonData:
            {
              version: '1.0',
              queryDate: '2019-05-27T08:17:07.386+0000',
              startDate: '2019-05-27T07:57:00.000+0000',
              statistic: 'Average',
              period: 300,
              recentDatapoints: [0.0, 0.0, 0.0],
              threshold: 0
            }
          }
        }
        const item: AlarmHistoryItem = {
          Timestamp: row.date,
          HistoryItemType: "StateUpdate",
          AlarmName: alarmName,
          HistoryData: JSON.stringify(history),
          HistorySummary: "not important"
        }

        // alarmHistory is returned in descending order
        alarmHistory.unshift(item)
      })

      AWS.mock('CloudWatch', 'describeAlarmHistory', alarmHistoryResp);
    })

  }

  function whenCloudWatchAlarmStateChanges(when) {
    when(/^CloudWatch alarm state changes to (.*) at "(.*)"$/, async (newState, time) => {

      const prevState = JSON.parse(alarmHistory[alarmHistory.length - 1].HistoryData || "{}").newState.stateValue

      const history = {
        version: '1.0',
        oldState:
        {
          stateValue: prevState,
          stateReason: 'blah'
        },
        newState:
        {
          stateValue: newState,
          stateReason: 'more blah',
          stateReasonData:
          {
            version: '1.0',
            queryDate: '2019-05-27T08:17:07.386+0000',
            startDate: '2019-05-27T07:57:00.000+0000',
            statistic: 'Average',
            period: 300,
            recentDatapoints: [0.0, 0.0, 0.0],
            threshold: 0
          }
        }
      }

      const item: AlarmHistoryItem = {
        Timestamp: time,
        HistoryItemType: "StateUpdate",
        AlarmName: alarmName,
        HistoryData: JSON.stringify(history),
        HistorySummary: "not important"
      }

      // alarmHistory is returned in descending order
      alarmHistory.unshift(item)

      const snsNotificationMessage: Partial<CloudWatchAlarmNotificationMessage> = {
        AlarmName: alarmName,
        NewStateValue: newState,
        OldStateValue: prevState,
        StateChangeTime: time,
      }

      const mockSnsEvent = {
        "Records": [
          {
            "EventSource": "aws:sns",
            "EventVersion": "1.0",
            "EventSubscriptionArn": "arn:aws:sns:eu-west-1:000000000000:cloudwatch-alarms:xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx",
            "Sns": {
              "Type": "Notification",
              "MessageId": "xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx",
              "TopicArn": "arn:aws:sns:eu-west-1:000000000000:cloudwatch-alarms",
              "Subject": "ALARM: \"Example alarm name\" in EU - Ireland",
              "Message": JSON.stringify(snsNotificationMessage),
              "Timestamp": "2017-01-12T16:30:42.318Z",
              "SignatureVersion": "1",
              "Signature": "Cg==",
              "SigningCertUrl": "https://sns.eu-west-1.amazonaws.com/SimpleNotificationService-xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx.pem",
              "UnsubscribeUrl": "https://sns.eu-west-1.amazonaws.com/?Action=Unsubscribe&SubscriptionArn=arn:aws:sns:eu-west-1:000000000000:cloudwatch-alarms:xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx",
              "MessageAttributes": {}
            }
          }
        ]
      }

      // simulate all the functions receiving the event
      await mttf(mockSnsEvent)
      await mttr(mockSnsEvent)
      await mtbf(mockSnsEvent)

    });
  }

  function thenCloudWatchMetricShouldBeGenerated(then) {
    then('the following CloudWatch metric should be generated:', (docString) => {
      const expected = JSON.parse(docString)
      const expectedTsStr = expected.MetricData[0].Timestamp
      expected.MetricData[0].Timestamp = new Date(expectedTsStr)
      expect(cloudWatchSpy).toBeCalledWith(expected)
    });
  }

});