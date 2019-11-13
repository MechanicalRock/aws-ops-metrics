import { SNSEvent } from "aws-lambda";
import { AlarmState } from "./alarmHistory";
import { calculateMetric } from "./common";

export async function handler(event: SNSEvent) {
  const metric = calculateMetric("MTTF", AlarmState.ALARM, AlarmState.OK);

  return await metric(event);

}
