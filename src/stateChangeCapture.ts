import { DynamoDB, CloudWatch, CodePipeline } from 'aws-sdk';
import { CloudwatchStateChangeEvent } from './common';
import { hasStateChanged } from './alarmHistory';
import { createDbEntry, getLastItemById } from './alarmEventStore';

export interface LastItemState {
  lastStateItemInDynamo: DynamoDB.DocumentClient.AttributeMap | null;
}

export function sanitizePipelineName(pipelineName: string | undefined): string {

  const sanitisePatterns = process.env.SANITISE_PATTERNS || "-pipeline"
  const removeWhitespace = (x: string) => x.trim()

  if (pipelineName) {
    const sanitise = pattern => {
      const matchResult = pipelineName.split(pattern)
      if (matchResult.length > 1) {
        return matchResult[0]
      } else {
        //no match
        return undefined
      }
    }
    const firstMatch = (result) => result !== undefined

    const sanitisedName = sanitisePatterns.split(',').map(removeWhitespace).map(sanitise).find(firstMatch)
    return sanitisedName || pipelineName
  }
  return ''

}

export class StateChangeCapture {
  state: LastItemState = {
    lastStateItemInDynamo: null,
  };
  public async run(event: CloudwatchStateChangeEvent): Promise<void> {
    if (event.detail.alarmName.endsWith('-service-health')) {
      return;
    }
    const stateChanged = await this.hasStatusChanged(event);

    if (stateChanged) {
      const pipelineName = await this.findPipelineName(event);
      const score = this.getScore(event.detail.state.value);
      const payload = {
        id: `ALARM_${event.detail.alarmName}`,
        resourceId: `${event.detail.state.timestamp}`,
        pipelineName: pipelineName,
        bookmarked: 'N',
        value: score,
        state: event.detail.state.value,
      };
      await createDbEntry(payload);
    }
  }

  private getScore(alarmState): number {
    if (alarmState === 'OK') {
      if (this.state && this.state.lastStateItemInDynamo) {
        return -1;
      }
      return 0;
    }
    return 1;
  }

  private async hasStatusChanged(event: CloudwatchStateChangeEvent): Promise<boolean> {
    const cw = new CloudWatch();
    if (event.detail.state.value === 'INSUFFICIENT_DATA') {
      return false;
    }
    const prevState = await this.getPreviousStateFromDynamo(event);

    if (prevState) {
      if (prevState !== event.detail.state.value) {
        return true;
      }
      return false;
    }
    console.log('Dynamo state was undefined');

    const alarmHistory = await cw
      .describeAlarmHistory({
        AlarmName: event.detail.alarmName,
        HistoryItemType: 'StateUpdate',
      })
      .promise();
    if (hasStateChanged(alarmHistory)) {
      console.log('State has changed');
      return true;
    }
    console.log('State has not changed');
    return false;
  }

  private async findPipelineName(event: CloudwatchStateChangeEvent): Promise<string> {
    if (
      this.state &&
      this.state.lastStateItemInDynamo &&
      this.state.lastStateItemInDynamo.pipelineName
    ) {
      return this.state.lastStateItemInDynamo.pipelineName;
    }
    const pipelineNames = await this.getPipelineNames();
    const pipelineName = pipelineNames
      ? pipelineNames.find(name =>
        name && event.detail && event.detail.alarmName
          ? event.detail.alarmName.toLowerCase().includes(name.toLowerCase())
          : false,
      )
      : '';
    if (!pipelineName) {
      throw new Error('pipelineName matching with alarmName was not found');
    }
    return pipelineName;
  }

  private async getPreviousStateFromDynamo(event: CloudwatchStateChangeEvent): Promise<string> {
    const data = await getLastItemById('ALARM_' + event.detail.alarmName);
    this.state.lastStateItemInDynamo = data.Items && data.Items.length > 0 ? data.Items[0] : null;
    const prevState = data.Items && data.Items.length > 0 ? data.Items[0].state : null;

    return prevState;
  }

  private async getPipelineNames(): Promise<string[]> {
    const codePipeline = new CodePipeline();
    try {
      const response = await codePipeline.listPipelines().promise();
      if (response.pipelines && response.pipelines.length > 0) {
        return response.pipelines.map(m => sanitizePipelineName(m.name));
      } else {
        return [];
      }
    } catch (e) {
      throw new Error(`There was an issue retrieving pipelines: ${e}`);
    }
  }
}
