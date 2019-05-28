import { DescribeAlarmHistoryOutput, AlarmHistoryItems } from "aws-sdk/clients/cloudwatch";

export enum AlarmState {
  OK = 'OK',
  ALARM = 'ALARM'
}

interface HistoryDataType {
  version: '1.0',
  oldState: {
    stateValue: string,
    stateReason: string,
  },
  newState:
  {
    stateValue: string,
    stateReason: string,
    stateReasonData:
    {
      version: '1.0',
      queryDate: string,
      startDate: string,
      statistic: string,
      period: number,
      recentDatapoints: number[],
      threshold: number
    }
  }
}

export function secondsBetween(alarmHistory: DescribeAlarmHistoryOutput, newState: AlarmState, oldState: AlarmState): number {
  let items = alarmHistory.AlarmHistoryItems || [];
  // const by = state => item => item.HistoryItemType === 'StateUpdate' && itemHasState(item.HistoryData, state);


  try {
    const newStateDate = dateOfFirst(items, newState)
    if (newState === oldState) {
      items = removeFirst(items, newState)
    }
    const oldStateDate = dateOfFirst(items, oldState)

    const diff = (newStateDate.getTime() - oldStateDate.getTime()) / 1000

    if (diff < 0) {
      const msg = `States [${newState},${oldState}] found in the wrong order`
      console.warn(msg)
      const up = new Error(msg)
      throw up
    }

    return diff
  } catch (err) {
    throw new Error(`No alarms found in order: [${newState}, ${oldState}] in ${JSON.stringify(alarmHistory)}`)
  }
}

const by = state => item => item.HistoryItemType === 'StateUpdate' && itemHasState(item.HistoryData, state);

function dateOfFirst(items, state) {
  const stateItem = items.find(by(state));
  return new Date(stateItem.Timestamp);

}

function removeFirst(items: AlarmHistoryItems, state: AlarmState) {
  const idx = items.findIndex(by(state))

  return items.filter((_, i) => i !== idx)
}

export function itemHasState(historyDataStr: string, state: AlarmState) {
  const historyData: Partial<HistoryDataType> = JSON.parse(historyDataStr) as HistoryDataType
  if (historyData.newState && historyData.newState.stateValue) {
    return historyData.newState.stateValue === state.toString()
  } else { 
    console.debug(
      console.info(`Item state not found in item: ${historyData}`))
    return false }
}
