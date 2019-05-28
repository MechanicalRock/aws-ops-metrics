import { defineFeature, loadFeature } from 'jest-cucumber';
import { Rocket } from '../../src/Rocket';
import { AlarmHistoryItems, AlarmHistoryItem } from 'aws-sdk/clients/cloudwatch';
import { CloudWatch } from 'aws-sdk';
// var MockDate = require('mockdate');
import * as MockDate from 'mockdate'
import { handler } from '../../src/mttf'


var AWS = require('aws-sdk-mock');

var foo: CloudWatch;

const feature = loadFeature('./features/lambda-metrics.feature');

defineFeature(feature, test => {
  test('Generate MTTF', ({ given, when, then }) => {
    var alarmHistory: AlarmHistoryItems = []
    let alarmName;
    let cloudWatchSpy = jest.fn().mockReturnValue({})

    beforeAll(async () => {

      AWS.mock('CloudWatch', 'putMetricData', (params, callback) => {
        callback(null,cloudWatchSpy(params))
      });

    })

    afterAll(() => {
      MockDate.reset()
    })

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
    });

    when(/^CloudWatch alarm state changes to ALARM at "(.*)"$/, async (time) => {

      MockDate.set(time)

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
          stateValue: 'ALARM',
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

      // TODO simulate a lambda notification.
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
              "Message": JSON.stringify(item),
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

      await handler(mockSnsEvent)

    });

    then('the following CloudWatch metric should be generated:', (docString) => {
      // const expected = {
      //   MetricData: [
      //     JSON.parse(docString)
      //   ],
      //   Namespace: "Operations"
      // };
      const expected = JSON.parse(docString)
      // const expectedTime = expected.MetricData[0].Timestamp
      expected.MetricData[0].Timestamp = expect.anything()
      expect(cloudWatchSpy).toBeCalledWith(expected)
    });
  });

  test('Service Restored', ({ given, when, then }) => {
    given(/^CloudWatch alarm (.*) has the following history:$/, (arg0, table) => {

    });

    when(/^CloudWatch alarm state changes to OK at "(.*)"$/, async (time) => {
    })

    then('the following CloudWatch metric should be generated:', (docString) => {

    });
  });

  test('Service Fails Again', ({ given, when, then }) => {
    given(/^CloudWatch alarm (.*) has the following history:$/, (arg0, table) => {

    });
    when(/^CloudWatch alarm state changes to ALARM at "(.*)"$/, async (time) => {
    })

    then('the following CloudWatch metric should be generated:', (docString) => {

    });
  });

});