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
export function hasStateChanged(alarmHistory: DescribeAlarmHistoryOutput) {
  let items = alarmHistory.AlarmHistoryItems || [];
  let itemsWithoutInsufficientData = items.filter(item => item.HistoryItemType === "StateUpdate" && item.HistoryData && !itemHasState(item.HistoryData, AlarmState.INSUFFICIENT_DATA));


  const noValidStateChanges = itemsWithoutInsufficientData.length < 2
  if (noValidStateChanges) {
    return false
  }

  const newState = getState(itemsWithoutInsufficientData[0].HistoryData);
  const prevState = getState(itemsWithoutInsufficientData[1].HistoryData);
  if (newState !== prevState) {
    return true;
  }
  return false;
}

export function secondsBetweenFromHistory(alarmHistory: DescribeAlarmHistoryOutput, newState: AlarmState, oldState: AlarmState):
  number {
  let items = alarmHistory.AlarmHistoryItems || [];

  try {
    const newStateDate = dateOfFirst(items, newState);
    if (newState === oldState) {
      items = removeFirst(items, newState);
    }
    const oldStateDate = dateOfFirst(items, oldState);
    const diff = calculateTheDifference(newStateDate, oldStateDate);
    return diff;
  } catch (err) {
    throw new Error(`No alarms found in order: [${newState}, ${oldState}] in ${JSON.stringify(alarmHistory)}`);
  }
}

export function secondsBetweenPreviouseState(event: CloudwatchStateChangeEvent):
  number {
  const newState = event.detail.state.value;
  const oldState = event.detail.previousState.value;
  try {
    const newStateDate = new Date(event.detail.state.timestamp);
    const oldStateDate = new Date(event.detail.previousState.timestamp);
    const diff = calculateTheDifference(newStateDate, oldStateDate);
    return diff;
  } catch (err) {
    throw new Error(`Failed to calculate the difference between: [new: ${newState}, old:${oldState}] in ${JSON.stringify(event)}`);
  }
}

function calculateTheDifference(newStateDate: Date, oldStateDate: Date): number {
  const diff = (newStateDate.getTime() - oldStateDate.getTime()) / 1000;
  console.log("Time difference is: ", diff);
  if (diff < 0) {
    const msg = `States [${newStateDate},${oldStateDate}] found in the wrong order`;
    console.warn(msg);
    const up = new Error(msg);
    throw up;
  }

  return diff;
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

export function getState(historyDataStr: string | undefined): string {
  const historyData: Partial<IHistoryDataType> = JSON.parse(historyDataStr || "{}") as IHistoryDataType;
  if (historyData.newState && historyData.newState.stateValue) {
    return historyData.newState.stateValue
  } else {
    console.debug(
      console.info(`Item state not found in item: ${historyData}`));
    return "unknown";
  }
}

export function itemHasState(historyDataStr: string, state: AlarmState) {
  const newState = getState(historyDataStr);
  return newState === state.toString();
}
