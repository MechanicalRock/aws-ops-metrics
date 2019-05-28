import { SNSEvent } from "aws-lambda";
import { AlarmState } from "./alarmHistory";

export function isAlarmEventForState(event: SNSEvent, state: AlarmState) {
  const newState = parse(event).NewStateValue || 'unknown'
  return newState === state
}

export function metricTimestampFromAlarmEvent(event: SNSEvent) {
  const timeStr = parse(event).StateChangeTime || new Date().toISOString()
  const metricTime = timeStr ? new Date(timeStr) : new Date()
  return metricTime
}

export function alarmNameFromAlarmEvent(event: SNSEvent): string {
  return parse(event).AlarmName || 'unknown'
}

function parse(event: SNSEvent) {
  return JSON.parse(event.Records[0].Sns.Message) as CloudWatchAlarmNotificationMessage
}

export interface CloudWatchAlarmNotificationMessage {
  AlarmName: string,
  AlarmDescription: string,
  AWSAccountId: string,
  NewStateValue: string,
  NewStateReason: string,
  StateChangeTime: string,
  Region: string,
  OldStateValue: string,
  Trigger:
  {
    MetricName: string,
    Namespace: string,
    StatisticType: string,
    Statistic: string,
    Unit: any,
    Dimensions: {
      value: string,
      name: string,
    }[],
    Period: number,
    EvaluationPeriods: number,
    ComparisonOperator: string,
    Threshold: number,
    TreatMissingData: string,
    EvaluateLowSampleCountPercentile: string
  }
}