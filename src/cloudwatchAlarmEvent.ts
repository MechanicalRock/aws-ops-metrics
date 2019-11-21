import { AlarmState } from "./alarmHistory";
import { CloudwatchStateChangeEvent } from './common';

export function isAlarmEventForState(event: CloudwatchStateChangeEvent, state: AlarmState) {
  const newState = event.detail.state.value || "unknown";
  return newState === state;
}

export function metricTimestampFromAlarmEvent(event: CloudwatchStateChangeEvent) {
  const timeStr = event.detail.state.timestamp || new Date().toISOString();
  const metricTime = timeStr ? new Date(timeStr) : new Date();
  return metricTime;
}

export function alarmNameFromAlarmEvent(event: CloudwatchStateChangeEvent): string {
  return event.detail.alarmName || "unknown";
}

export interface ICloudWatchAlarmNotificationMessage {
  AlarmName: string;
  AlarmDescription: string;
  AWSAccountId: string;
  NewStateValue: string;
  NewStateReason: string;
  StateChangeTime: string;
  Region: string;
  OldStateValue: string;
  Trigger:
  {
    MetricName: string,
    Namespace: string,
    StatisticType: string,
    Statistic: string,
    Unit: any,
    Dimensions: Array<{
      value: string,
      name: string,
    }>,
    Period: number,
    EvaluationPeriods: number,
    ComparisonOperator: string,
    Threshold: number,
    TreatMissingData: string,
    EvaluateLowSampleCountPercentile: string,
  };
}
