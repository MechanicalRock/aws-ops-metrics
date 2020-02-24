import { CloudWatch } from 'aws-sdk';
import { AlarmState, secondsBetweenFromHistory, hasStateChanged } from './alarmHistory';
import {
  alarmNameFromAlarmEvent,
  isAlarmEventForState,
  metricTimestampFromAlarmEvent,
} from './cloudwatchAlarmEvent';

export interface CloudwatchStateChangeEvent {
  version: string;
  id: string;
  'detail-type': string;
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
    };
    previousState: {
      value: string;
      reason: string;
      reasonData: string;
      timestamp: string;
    };
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
              };
            };
            period: number;
            stat: string;
          };
          returnData: boolean;
        },
      ];
    };
  };
}

export function sortItemsByResourceId(items: AWS.DynamoDB.DocumentClient.QueryOutput) {
  if (items.Items) {
    const sortedlist = items.Items.sort((a, b) => (a.resourceId > b.resourceId ? 1 : -1));
    return sortedlist;
  }
  return [];
}

export function matchesBlackList(alarmName: string): boolean {
  if (process.env.IGNORED_ALARM_NAME_PATTERN) {
    const ignoredAlarmNamePatternMatch = alarmName.match(process.env.IGNORED_ALARM_NAME_PATTERN);
    if (ignoredAlarmNamePatternMatch) {
      return true;
    }
  }
  return false;
}

export function calculateMetric(metric: string, newState: AlarmState, oldState: AlarmState) {
  return async (event: CloudwatchStateChangeEvent) => {
    const cw = new CloudWatch();
    console.debug('Event received: ' + JSON.stringify(event));
    if (matchesBlackList(event.detail.alarmName)) {
      console.debug(`The alarm matches the blacklist alarm pattern therefore Ignoring it`);

      console.debug(
        `Alarm name: ${event.detail.alarmName} \nBlacklist Pattern: ${process.env.IGNORED_ALARM_NAME_PATTERN}`,
      );
      return {};
    }

    if (!isAlarmEventForState(event, newState)) {
      console.debug(`State '${newState}' not matched for event. Ignoring`);
      return {};
    }

    const metricTime = metricTimestampFromAlarmEvent(event);
    const service = alarmNameFromAlarmEvent(event);
    let duration = 0;
    try {
      const alarmHistory = await cw
        .describeAlarmHistory({
          AlarmName: service,
          HistoryItemType: 'StateUpdate',
        })
        .promise();
      if (!hasStateChanged(alarmHistory)) {
        return {};
      }
      duration = secondsBetweenFromHistory(alarmHistory, newState, oldState);
      console.info(`Publishing ${metric}: ${duration}`);
      const metricInput = {
        MetricData: [
          {
            MetricName: metric,
            Dimensions: [
              {
                Name: 'service',
                Value: service,
              },
            ],
            Timestamp: metricTime,
            Value: duration,
            Unit: 'Seconds',
          },
        ],
        Namespace: 'Operations',
      };

      if (service.endsWith('-service-health')) {
        metricInput.MetricData.push({
          MetricName: metric,
          Dimensions: [
            {
              Name: 'account',
              Value: event.account,
            },
          ],
          Timestamp: metricTime,
          Value: duration,
          Unit: 'Seconds',
        });
      }

      await cw.putMetricData(metricInput).promise();
    } catch (err) {
      console.warn(`Failed to generate metric: ${err}`);

      // ignore
      return {};
    }
  };
}
