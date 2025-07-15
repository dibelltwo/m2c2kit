import { ActivityKeyValueData } from "./ActivityKeyValueData";
import { TrialData } from "./TrialData";

export interface GameData extends ActivityKeyValueData {
  trials: Array<TrialData>;
  scoring: ActivityKeyValueData;
}
