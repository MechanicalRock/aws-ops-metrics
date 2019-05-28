import { SNSEvent } from "aws-lambda";
import { AlarmState } from "./alarmHistory";
import { calculateMetric } from "./common";

export async function handler(event: SNSEvent) {

  const metric = calculateMetric('MTTR', AlarmState.OK, AlarmState.ALARM)

  return await metric(event)

}