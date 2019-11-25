import { AlarmState } from "./alarmHistory";
import { calculateMetric, CloudwatchStateChangeEvent } from "./common";

export async function handler(event: CloudwatchStateChangeEvent) {
  const metric = calculateMetric("MTTF", AlarmState.ALARM, AlarmState.OK);

  return await metric(event);

}
