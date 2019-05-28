import { SNSEvent } from "aws-lambda";
import { AlarmState } from "./alarmHistory";
import { calculateMetric } from "./common";

export async function handler(event: SNSEvent) {

  const metric = calculateMetric('MTBF', AlarmState.ALARM, AlarmState.ALARM)
  
  return await metric(event)

}