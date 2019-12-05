import { secondsBetweenFromHistory, AlarmState, hasStateChanged } from '../src/alarmHistory'
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

  describe('#hasStateChanged()', () => {

    it('should return false when old and new states are the same', () => {
      const output = describeAlarmHistory(
        stateUpdate("2019-01-01T00:03:30.000Z", AlarmState.OK),
        stateUpdate("2019-01-01T00:02:30.000Z", AlarmState.OK),
        stateUpdate("2019-01-01T00:01:30.000Z", AlarmState.OK),
        stateUpdate("2019-01-01T00:00:30.000Z", AlarmState.ALARM))

      expect(hasStateChanged(output)).toBe(false)
    });

    it('should return true when old and new states are different', () => {
      const output = describeAlarmHistory(
        stateUpdate("2019-01-01T00:03:30.000Z", AlarmState.OK),
        stateUpdate("2019-01-01T00:02:30.000Z", AlarmState.ALARM),
        stateUpdate("2019-01-01T00:02:30.000Z", AlarmState.ALARM),
        stateUpdate("2019-01-01T00:01:30.000Z", AlarmState.OK),
        stateUpdate("2019-01-01T00:00:30.000Z", AlarmState.ALARM))

      expect(hasStateChanged(output)).toBe(true)
    })

    it('should ignore INSUFFICIENT_DATA - same state', () => {
      const output = describeAlarmHistory(
        stateUpdate("2019-01-01T00:03:30.000Z", AlarmState.ALARM),
        stateUpdate("2019-01-01T00:02:30.000Z", AlarmState.INSUFFICIENT_DATA),
        stateUpdate("2019-01-01T00:02:30.000Z", AlarmState.ALARM),
        stateUpdate("2019-01-01T00:01:30.000Z", AlarmState.INSUFFICIENT_DATA),
        stateUpdate("2019-01-01T00:00:30.000Z", AlarmState.ALARM))

      expect(hasStateChanged(output)).toBe(false)
    })

    it('should ignore INSUFFICIENT_DATA - different state', () => {
      const output = describeAlarmHistory(
        stateUpdate("2019-01-01T00:03:30.000Z", AlarmState.ALARM),
        stateUpdate("2019-01-01T00:02:30.000Z", AlarmState.INSUFFICIENT_DATA),
        stateUpdate("2019-01-01T00:02:30.000Z", AlarmState.OK),
        stateUpdate("2019-01-01T00:01:30.000Z", AlarmState.INSUFFICIENT_DATA),
        stateUpdate("2019-01-01T00:00:30.000Z", AlarmState.ALARM))

      expect(hasStateChanged(output)).toBe(true)
    })

    it('state changed to INSUFFICIENT_DATA', () => {
      const output = describeAlarmHistory(
        stateUpdate("2019-01-01T00:03:30.000Z", AlarmState.INSUFFICIENT_DATA),
        stateUpdate("2019-01-01T00:02:30.000Z", AlarmState.ALARM),
        stateUpdate("2019-01-01T00:02:30.000Z", AlarmState.OK),
        stateUpdate("2019-01-01T00:01:30.000Z", AlarmState.INSUFFICIENT_DATA),
        stateUpdate("2019-01-01T00:00:30.000Z", AlarmState.ALARM))

      expect(hasStateChanged(output)).toBe(true);
    })
    it('state changed to INSUFFICIENT_DATA', () => {
      const output = describeAlarmHistory(
        stateUpdate("2019-01-01T00:03:30.000Z", AlarmState.INSUFFICIENT_DATA),
        stateUpdate("2019-01-01T00:02:30.000Z", AlarmState.ALARM),
        stateUpdate("2019-01-01T00:02:30.000Z", AlarmState.INSUFFICIENT_DATA),
        stateUpdate("2019-01-01T00:01:30.000Z", AlarmState.ALARM),
        stateUpdate("2019-01-01T00:00:30.000Z", AlarmState.ALARM))

      expect(hasStateChanged(output)).toBe(false);
    })

    it('should return false if no data available', () => {
      const output = describeAlarmHistory(
        stateUpdate("2019-01-01T00:03:30.000Z", AlarmState.INSUFFICIENT_DATA))

      expect(hasStateChanged(output)).toBe(false)
    })

    it('should return false if the state has not changed between two valid states', () => {
      const output = describeAlarmHistory(
        stateUpdate("2019-01-01T00:03:30.000Z", AlarmState.OK))

      expect(hasStateChanged(output)).toBe(false)
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
