import { DynamoDB, CloudWatch, CodePipeline } from 'aws-sdk';
import { CloudwatchStateChangeEvent } from "./common";
import { hasStateChanged } from './alarmHistory';
import { createDbEntry, getLastItemById } from './alarmEventStore';

export interface ILastItemState {
  lastStateItemInDynamo: DynamoDB.DocumentClient.AttributeMap | null;
}

export class StateChangeCapture {
  state: ILastItemState = {
    lastStateItemInDynamo: null
  };
  public async run(event: CloudwatchStateChangeEvent) {
    const stateChanged = await this.hasStatusChanged(event);

    if (stateChanged) {
      const pipelineName = await this.findPipelineName(event);
      const score = this.getScore(event.detail.state.value);
      const payload = {
        id: `ALARM_${event.detail.alarmName}`,
        resourceId: `${event.detail.state.timestamp}`,
        pipelineName: pipelineName,
        bookmarked: "N",
        value: score,
        state: event.detail.state.value
      }
      await createDbEntry(payload)
    }
  }

  private getScore(alarmState) {
    if (alarmState === "OK") {
      if (this.state && this.state.lastStateItemInDynamo) {
        return (-1)
      }
      return 0;
    }
    return 1;
  }

  private async hasStatusChanged(event: CloudwatchStateChangeEvent) {
    const cw = new CloudWatch();
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

    const alarmHistory = await cw.describeAlarmHistory({
      AlarmName: event.detail.alarmName,
      HistoryItemType: "StateUpdate",
    }).promise();
    if (hasStateChanged(alarmHistory)) {
      console.log("State has changed");
      return true;
    }
    console.log("State has not changed");
    return false
  }

  private async findPipelineName(event: CloudwatchStateChangeEvent) {
    if (this.state && this.state.lastStateItemInDynamo && this.state.lastStateItemInDynamo.pipelineName) {
      return this.state.lastStateItemInDynamo.pipelineName;
    }
    const pipelineNames = await this.getPipelineNames();
    const pipelineName = pipelineNames ? pipelineNames.find(name => name ? name.toLowerCase().includes(event.detail.alarmName.toLowerCase()) : false) : "";
    if (!pipelineName) {
      throw new Error("pipelineName matching with alarmName was not found");
    }
    return pipelineName;
  }

  private async getPreviousStateFromDynamo(event: CloudwatchStateChangeEvent) {
    const data = await getLastItemById("ALARM_" + event.detail.alarmName);
    this.state.lastStateItemInDynamo = data.Items && data.Items.length > 0 ? data.Items[0] : null;
    let prevState = data.Items && data.Items.length > 0 ? data.Items[0].state : null

    return prevState;
  }

  private async getPipelineNames() {
    const codePipeline = new CodePipeline();
    try {
      const response = await codePipeline.listPipelines().promise();
      return response.pipelines ? response.pipelines.map(m => m.name) : [];
    }
    catch (e) {
      console.log("There was an issue retrieving pipelines: ", e);
    }
  }
}
