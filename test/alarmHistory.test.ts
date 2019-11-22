import { secondsBetweenFromHistory, secondsBetweenPreviouseState, AlarmState } from '../src/alarmHistory'
import { DescribeAlarmHistoryOutput } from 'aws-sdk/clients/cloudwatch';
import { CloudwatchStateChangeEvent } from '../src/common';

describe('alarmHistory', () => {
  describe('#secondsBetweenFromHistory()', () => {
    it('should calculate the time between two different states', () => {

      const output = describeAlarmHistory(
        stateUpdate("2019-01-01T00:01:30.000Z", AlarmState.ALARM),
        stateUpdate("2019-01-01T00:00:30.000Z", AlarmState.OK))

      expect(secondsBetweenFromHistory(output, AlarmState.ALARM, AlarmState.OK)).toBe(60)
    })

    it('should calculate the time between subsequent items of the same state', () => {

      const output = describeAlarmHistory(
        stateUpdate("2019-01-01T00:01:30.000Z", AlarmState.ALARM),
        stateUpdate("2019-01-01T00:00:00.000Z", AlarmState.ALARM),
      )

      expect(secondsBetweenFromHistory(output, AlarmState.ALARM, AlarmState.ALARM)).toBe(90)
    })

    it('should fail if history is empty', () => {
      expect(() => secondsBetweenFromHistory({}, AlarmState.ALARM, AlarmState.OK)).toThrow()
    })

    it('should fail if the two states do not exist', () => {

      expect(() => secondsBetweenFromHistory({}, AlarmState.ALARM, AlarmState.OK)).toThrow()
    })

    it('should fail if the requested states are in the wrong order', () => {

      const output = describeAlarmHistory(
        stateUpdate("2019-01-01T00:02:30.000Z", AlarmState.OK),
        stateUpdate("2019-01-01T00:01:30.000Z", AlarmState.ALARM),
      )

      expect(() => secondsBetweenFromHistory(output, AlarmState.ALARM, AlarmState.OK)).toThrow()
    })

  });
  describe('#secondsBetweenPreviouseState()', () => {
    var cloudwatchEvent: CloudwatchStateChangeEvent = {
      "version": "0",
      "id": "d0926dec-1b81-ee8e-dc07-769e3f0ba5e9",
      "detail-type": "CloudWatch Alarm State Change",
      "source": "aws.cloudwatch",
      "account": "516453972500",
      "time": "2019-11-21T04:18:51Z",
      "region": "ap-southeast-2",
      "resources": [
        "arn:aws:cloudwatch:ap-southeast-2:516453972500:alarm:flaky-service"
      ],
      "detail": {
        "alarmName": "flaky-service",
        "state": {
          "value": "OK",
          "reason": "Threshold Crossed: 1 out of the last 1 datapoints [0.0 (21/11/19 04:17:00)] was not greater than the threshold (0.0) (minimum 1 datapoint for ALARM -> OK transition).",
          "reasonData": "{\"version\":\"1.0\",\"queryDate\":\"2019-11-21T04:18:51.691+0000\",\"startDate\":\"2019-11-21T04:17:00.000+0000\",\"statistic\":\"Sum\",\"period\":60,\"recentDatapoints\":[0.0],\"threshold\":0.0}",
          "timestamp": "2019-11-21T04:18:51.695+0000"
        },
        "previousState": {
          "value": "ALARM",
          "reason": "Threshold Crossed: 1 out of the last 1 datapoints [2.0 (21/11/19 04:12:00)] was greater than the threshold (0.0) (minimum 1 datapoint for OK -> ALARM transition).",
          "reasonData": "{\"version\":\"1.0\",\"queryDate\":\"2019-11-21T04:13:51.670+0000\",\"startDate\":\"2019-11-21T04:12:00.000+0000\",\"statistic\":\"Sum\",\"period\":60,\"recentDatapoints\":[2.0],\"threshold\":0.0}",
          "timestamp": "2019-11-21T04:13:51.675+0000"
        },
        "configuration": {
          "description": "Example alarm for a flaky service - demonstrate capturing metrics based on alarms.",
          "metrics": [
            {
              "id": "3eb73172-e6c5-37b2-2009-3eac67a36802",
              "metricStat": {
                "metric": {
                  "namespace": "AWS/Lambda",
                  "name": "Errors",
                  "dimensions": {
                    "FunctionName": "lambda-ops-metrics-eg-dev-flaky"
                  }
                },
                "period": 60,
                "stat": "Sum"
              },
              "returnData": true
            }
          ]
        }
      }
    }
    it('should calculate the time between two different states', () => {
      let modifyEvent: CloudwatchStateChangeEvent = { ...cloudwatchEvent };
      modifyEvent.detail.state.value = "ALARM";
      modifyEvent.detail.state.timestamp = "2019-01-01T00:01:30.000Z";
      modifyEvent.detail.previousState.value = "OK";
      modifyEvent.detail.previousState.timestamp = "2019-01-01T00:00:30.000Z";

      expect(secondsBetweenPreviouseState(modifyEvent, AlarmState.ALARM, AlarmState.OK)).toBe(60)
    })

    it('should calculate the time between subsequent items of the same state', () => {
      let modifyEvent: CloudwatchStateChangeEvent = { ...cloudwatchEvent };
      modifyEvent.detail.state.value = "ALARM";
      modifyEvent.detail.state.timestamp = "2019-01-01T00:01:30.000Z";
      modifyEvent.detail.previousState.value = "ALARM";
      modifyEvent.detail.previousState.timestamp = "2019-01-01T00:00:00.000Z";
      expect(secondsBetweenPreviouseState(modifyEvent, AlarmState.ALARM, AlarmState.ALARM)).toBe(90)
    })

    it('should fail if cloudwatch event is empty', () => {
      expect(() => secondsBetweenPreviouseState({} as CloudwatchStateChangeEvent, AlarmState.ALARM, AlarmState.OK)).toThrow()
    })

    it('should fail if the requested states are in the wrong order', () => {
      let modifyEvent: CloudwatchStateChangeEvent = { ...cloudwatchEvent };
      modifyEvent.detail.state.value = "OK";
      modifyEvent.detail.state.timestamp = "2019-01-01T00:01:30.000Z";
      modifyEvent.detail.previousState.value = "ALARM";
      modifyEvent.detail.previousState.timestamp = "2019-01-01T00:02:30.000Z";

      expect(() => secondsBetweenPreviouseState(modifyEvent, AlarmState.OK, AlarmState.ALARM)).toThrow()
    })

  })
})

function stateUpdate(timestamp: string, stateValue: AlarmState) {
  return {
    HistoryItemType: "StateUpdate",
    Timestamp: new Date(timestamp),
    HistoryData: JSON.stringify({
      newState:
      {
        stateValue: stateValue.toString(),
      }
    })
  }
}

function describeAlarmHistory(...items): DescribeAlarmHistoryOutput {
  return {
    AlarmHistoryItems: items
  }
}
