import { SNSEvent } from "aws-lambda";
import { CloudWatch } from "aws-sdk";
import { metricTimestampFromAlarmEvent, alarmNameFromAlarmEvent, isAlarmEventForState } from "./cloudwatchAlarmSnsEvent";
import { AlarmState, secondsBetween } from "./alarmHistory";

export function calculateMetric(metric: string, newState: AlarmState, oldState: AlarmState) {

  return async (event: SNSEvent) => {
    const cw = new CloudWatch()

    console.debug('Event received: ' + JSON.stringify(event))

    if (!isAlarmEventForState(event, newState)) {
      console.debug(`State '${newState}' not metched for event.  Ignoring`)
      return {}
    }


    const metricTime = metricTimestampFromAlarmEvent(event)
    const service = alarmNameFromAlarmEvent(event)

    const alarmHistory = await cw.describeAlarmHistory({
      AlarmName: service,
      HistoryItemType: "StateUpdate"
    }).promise()


    try{
      const duration = secondsBetween(alarmHistory, newState, oldState )

      await cw.putMetricData({
        MetricData: [
          {
            "MetricName": metric,
            "Dimensions": [
              {
                "Name": "service",
                "Value": service
              }
            ],
            "Timestamp": metricTime,
            "Value": duration,
            "Unit": "Seconds"
          }
        ],
        Namespace: "Operations"
      }).promise()
    }catch(err) {
      console.warn(`Failed to generate metric: ${err}`)

      //ignore
      return {}
    }



  }
}