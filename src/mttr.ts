import { AlarmState } from "./alarmHistory";
import { calculateMetric, CloudwatchStateChangeEvent } from "./common";

export async function handler(event: CloudwatchStateChangeEvent) {

  const metric = calculateMetric("MTTR", AlarmState.OK, AlarmState.ALARM);

  return await metric(event);

}
