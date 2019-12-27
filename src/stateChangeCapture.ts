import * as AWS from 'aws-sdk';
import { CloudwatchStateChangeEvent } from "./common";
import { metricTimestampFromAlarmEvent } from './cloudwatchAlarmEvent';
import { hasStateChanged } from './alarmHistory';
import { createDbEntry, getLastItemById } from './alarmEventStore';

if (!AWS.config.region) {
  AWS.config.region = "ap-southeast-2";
}

export interface ILastItemState {
  lastStateItemInDynamo: AWS.DynamoDB.DocumentClient.AttributeMap | null;
}

export class StateChangeCapture {
  state: ILastItemState = {
    lastStateItemInDynamo: null
  };
  public async run(event: CloudwatchStateChangeEvent) {
    const stateChanged = await this.hasStatusChanged(event);

    if (stateChanged) {
      const pipelineName = await this.findPipelineName(event);
      const value = event.detail.state.value === "ALARM" ? 1 : -1;
      const payload = {
        id: event.detail.alarmName,
        resourceId: pipelineName,
        value: value,
        state: event.detail.state.value,
        eventTime: event.detail.state.timestamp
      }
      await createDbEntry(payload)
    }
  }

  private async hasStatusChanged(event: CloudwatchStateChangeEvent) {
    const cw = new AWS.CloudWatch();
    if (event.detail.state.value === "INSUFFICIENT_DATA") {
      return false;
    }
    const prevState = await this.getPreviousStateFromDynamo(event);

    if (prevState) {
      if (prevState !== event.detail.state.value) {
        return true;
      }
      return false;
    }
    console.log("Dynamo state was undefined");

    ///TODO: Discuss to see if this is required?
    // If the item doesn't exist in dynamo we might just wanna store it for first time
    // If it's first time and status is OK, you may wanna add 0 instead of -1
    const alarmHistory = await cw.describeAlarmHistory({
      AlarmName: event.detail.alarmName,
      HistoryItemType: "StateUpdate",
    }).promise();
    console.log("Alarm history: ", alarmHistory);
    if (hasStateChanged(alarmHistory)) {
      console.log("State has changed");
      return true;
    }
    console.log("State has not changed");
    return false
  }

  private async findPipelineName(event: CloudwatchStateChangeEvent) {
    if (this.state && this.state.lastStateItemInDynamo && this.state.lastStateItemInDynamo.resourceId) {
      return this.state.lastStateItemInDynamo.resourceId;
    }
    const pipelineNames = await this.getPipelineNames();
    const pipelineName = pipelineNames ? pipelineNames.find(name => name ? name.toLowerCase().includes(event.detail.alarmName.toLowerCase()) : false) : "";
    if (!pipelineName) {
      throw new Error("pipelineName matching with alarmName was not found");
    }
    return pipelineName;
  }

  private async getPreviousStateFromDynamo(event: CloudwatchStateChangeEvent) {
    const data = await getLastItemById(event.detail.alarmName);
    this.state.lastStateItemInDynamo = data.Items && data.Items.length > 0 ? data.Items[0] : null;
    let prevState = data.Items && data.Items.length > 0 ? data.Items[0].state : null

    return prevState;
  }

  private async getPipelineNames() {
    const codePipeline = new AWS.CodePipeline();
    try {
      const response = await codePipeline.listPipelines().promise();
      return response.pipelines ? response.pipelines.map(m => m.name) : [];
    }
    catch (e) {
      console.log("There was an issue retrieving pipelines: ", e);
    }
  }
}
