import { StateChangeCapture } from './stateChangeCapture';
import { CloudwatchStateChangeEvent } from "./common";

export async function handler(event: CloudwatchStateChangeEvent) {
  await new StateChangeCapture().run(event);
}
