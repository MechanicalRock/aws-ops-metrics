import { AlarmHistoryItems, DescribeAlarmHistoryOutput } from "aws-sdk/clients/cloudwatch";
import { CloudwatchStateChangeEvent } from './common';

export enum AlarmState {
  OK = "OK",
  ALARM = "ALARM",
  INSUFFICIENT_DATA = "INSUFFICIENT_DATA"
}

interface IHistoryDataType {
  version: "1.0";
  oldState: {
    stateValue: string,
    stateReason: string,
  };
  newState:
  {
    stateValue: string,
    stateReason: string,
    stateReasonData:
    {
      version: "1.0",
      queryDate: string,
      startDate: string,
      statistic: string,
      period: number,
      recentDatapoints: number[],
      threshold: number,
    },
  };
}

export function secondsBetweenFromHistory(alarmHistory: DescribeAlarmHistoryOutput, newState: AlarmState, oldState: AlarmState):
  number {
  let items = alarmHistory.AlarmHistoryItems || [];
  // const by = state => item => item.HistoryItemType === 'StateUpdate' && itemHasState(item.HistoryData, state);

  try {
    const newStateDate = dateOfFirst(items, newState);
    if (newState === oldState) {
      items = removeFirst(items, newState);
    }
    const oldStateDate = dateOfFirst(items, oldState);

    const diff = (newStateDate.getTime() - oldStateDate.getTime()) / 1000;

    if (diff < 0) {
      const msg = `States [${newState},${oldState}] found in the wrong order`;
      console.warn(msg);
      const up = new Error(msg);
      throw up;
    }

    return diff;
  } catch (err) {
    throw new Error(`No alarms found in order: [${newState}, ${oldState}] in ${JSON.stringify(alarmHistory)}`);
  }
}

export function secondsBetweenPreviouseState(event: CloudwatchStateChangeEvent, newState: AlarmState, oldState: AlarmState):
  number {
  try {
    const newStateDate = new Date(event.detail.state.timestamp);
    const oldStateDate = new Date(event.detail.previousState.timestamp);

    const diff = (newStateDate.getTime() - oldStateDate.getTime()) / 1000;
    console.log("Time difference is: ", diff);

    if (diff < 0) {
      const msg = `States [${newState},${oldState}] found in the wrong order`;
      console.warn(msg);
      const up = new Error(msg);
      throw up;
    }

    return diff;
  } catch (err) {
    throw new Error(`Failed to calculate the difference between: [new: ${newState}, old:${oldState}] in ${JSON.stringify(event)}`);
  }
}

const by = (state) => (item) => item.HistoryItemType === "StateUpdate" && itemHasState(item.HistoryData, state);

function dateOfFirst(items, state) {
  const stateItem = items.find(by(state));
  return new Date(stateItem.Timestamp);
}

function removeFirst(items: AlarmHistoryItems, state: AlarmState) {
  const idx = items.findIndex(by(state));

  return items.filter((_, i) => i !== idx);
}

export function itemHasState(historyDataStr: string, state: AlarmState) {
  const historyData: Partial<IHistoryDataType> = JSON.parse(historyDataStr) as IHistoryDataType;
  if (historyData.newState && historyData.newState.stateValue) {
    return historyData.newState.stateValue === state.toString();
  } else {
    console.debug(
      console.info(`Item state not found in item: ${historyData}`));
    return false;
  }
}
