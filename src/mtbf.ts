import { AlarmState } from "./alarmHistory";
import { calculateMetric, CloudwatchStateChangeEvent } from "./common";

export async function handler(event: CloudwatchStateChangeEvent) {

  const metric = calculateMetric("MTBF", AlarmState.ALARM, AlarmState.ALARM);

  return await metric(event);

}
