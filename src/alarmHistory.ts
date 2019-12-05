import { AlarmHistoryItems, DescribeAlarmHistoryOutput, AlarmHistoryItem } from "aws-sdk/clients/cloudwatch";

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
    const newStateDate = dateOfFirstUnique(items, newState);
    if (newState === oldState) {
      items = removeFirst(items, newState);
    }
    const oldStateDate = dateOfFirstUnique(items, oldState);
    const diff = calculateTheDifference(newStateDate, oldStateDate);
    return diff;
  } catch (err) {
    throw new Error(`No alarms found in order: [${newState}, ${oldState}] in ${JSON.stringify(alarmHistory)}`);
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

function dateOfFirstUnique(items: AlarmHistoryItems, state: AlarmState) {
  const firstUniqueState = (current: AlarmHistoryItem, index: number, all: AlarmHistoryItems) => {
    const currentState = getState(current.HistoryData);
    const expectedStateStr = state.toString();
    if (index == all.length - 1) {
      return currentState === expectedStateStr
    }
    if (currentState !== expectedStateStr) {
      return false
    }
    if (currentState === getState(all[index + 1].HistoryData)) {
      return false
    }
    return true
  }

  let itemsWithoutInsufficientData = items.filter(item => item.HistoryItemType === "StateUpdate" && item.HistoryData && !itemHasState(item.HistoryData, AlarmState.INSUFFICIENT_DATA));
  const found: AlarmHistoryItem | undefined = itemsWithoutInsufficientData.find(firstUniqueState);
  if (found && found.Timestamp) {
    return new Date(found.Timestamp);
  }

  throw new Error(`State ${state} was not found ${JSON.stringify(items)}`);
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
