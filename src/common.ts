import { CloudWatch } from "aws-sdk";
import { AlarmState, secondsBetweenFromHistory, secondsBetweenPreviouseState } from "./alarmHistory";
import {
  alarmNameFromAlarmEvent, isAlarmEventForState,
  metricTimestampFromAlarmEvent,
} from "./cloudwatchAlarmEvent";

export interface CloudwatchStateChangeEvent {
  version: string;
  id: string;
  "detail-type": string;
  source: string;
  account: string;
  time: string;
  region: string;
  resources: string[];
  detail: {
    alarmName: string;
    state: {
      value: string;
      reason: string;
      reasonData: string;
      timestamp: string;
    },
    previousState: {
      value: string;
      reason: string;
      reasonData: string;
      timestamp: string;
    },
    configuration: {
      description: string;
      metrics?: [
        {
          id: string;
          metricStat: {
            metric: {
              namespace: string;
              name: string;
              dimensions: {
                FunctionName: string;
              }
            },
            period: number;
            stat: string;
          },
          returnData: boolean;
        }
      ]
    }
  }
}

export function calculateMetric(metric: string, newState: AlarmState, oldState: AlarmState) {

  return async (event: CloudwatchStateChangeEvent) => {
    const cw = new CloudWatch();

    console.debug("Event received: " + JSON.stringify(event));

    if (!isAlarmEventForState(event, newState)) {
      console.debug(`State '${newState}' not metched for event.  Ignoring`);
      return {};
    }

    const metricTime = metricTimestampFromAlarmEvent(event);
    const service = alarmNameFromAlarmEvent(event);
    let duration = 0;
    try {
      console.log("previous state is:", event.detail.previousState.value);
      console.log("Old state is:", oldState);
      if (event.detail.previousState.value === oldState.toString()) {
        console.log("here");
        duration = secondsBetweenPreviouseState(event, newState, oldState);
      }
      else {
        const alarmHistory = await cw.describeAlarmHistory({
          AlarmName: service,
          HistoryItemType: "StateUpdate",
        }).promise();
        duration = secondsBetweenFromHistory(alarmHistory, newState, oldState);
      }

      await cw.putMetricData({
        MetricData: [
          {
            MetricName: metric,
            Dimensions: [
              {
                Name: "service",
                Value: service,
              },
            ],
            Timestamp: metricTime,
            Value: duration,
            Unit: "Seconds",
          },
        ],
        Namespace: "Operations",
      }).promise();
    } catch (err) {
      console.warn(`Failed to generate metric: ${err}`);

      // ignore
      return {};
    }

  };
}
