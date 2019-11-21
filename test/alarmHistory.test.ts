import { secondsBetweenFromHistory, AlarmState } from '../src/alarmHistory'
import { DescribeAlarmHistoryOutput } from 'aws-sdk/clients/cloudwatch';

describe('alarmHistory', () => {
  describe('#secondsBetween()', () => {
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
