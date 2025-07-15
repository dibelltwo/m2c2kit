import { ActivityKeyValueData } from "./ActivityKeyValueData";
import { DeviceMetadata, deviceMetadataSchema } from "./DeviceMetadata";
import { Game } from "./Game";
import { GameData } from "./GameData";
import {
  JsonSchema,
  JsonSchemaDataType,
  JsonSchemaDataTypeScriptTypes,
} from "./JsonSchema";
import { M2Error } from "./M2Error";
import { ScoringSchema } from "./ScoringSchema";
import { TrialData } from "./TrialData";
import { TrialSchema } from "./TrialSchema";
import { Uuid } from "./Uuid";
import { WebGlInfo } from "./WebGlInfo";

/**
 * Manages the participant data for a game.
 *
 * @internal For m2c2kit library use only
 *
 * @param game - The game instance that this DataManager is associated with.
 */
export class DataManager {
  private game: Game;
  private webGlRendererInfo = "";
  public data: GameData = {
    trials: new Array<TrialData>(),
    scoring: {},
  };
  public trialIndex = 0;
  public staticTrialSchema = <
    { [key: string]: JsonSchemaDataTypeScriptTypes }
  >{};

  constructor(game: Game) {
    this.game = game;
  }

  /**
   * Initializes the participant data structure for a new game.
   *
   * @remarks This method should be called once at the start of a new game.
   */
  initializeData(): void {
    this.trialIndex = 0;
    this.data = {
      trials: new Array<TrialData>(),
      scoring: {},
    };
    const trialSchema = this.game.options.trialSchema ?? {};
    const scoringSchema = this.game.options.scoringSchema ?? {};

    this.validateSchema(trialSchema);
    this.validateSchema(scoringSchema);
  }

  /**
   * The m2c2kit engine will automatically include these schema and their
   * values in the trial data.
   *
   * @remarks These are in the `Game` class, rather than in the `DataManager`
   * class, because the schema-util parses the code to find these
   * properties, and it expects them in the `Game` class.
   */
  private readonly automaticTrialSchema: TrialSchema = {
    data_type: {
      type: "string",
      description: "Type of data.",
    },
    study_id: {
      type: ["string", "null"],
      description:
        "The short human-readable text ID of the study (protocol, experiment, or other aggregate) that contains the administration of this activity.",
    },
    study_uuid: {
      type: ["string", "null"],
      format: "uuid",
      description:
        "Unique identifier of the study (protocol, experiment, or other aggregate) that contains the administration of this activity.",
    },
    document_uuid: {
      type: "string",
      format: "uuid",
      description: "Unique identifier for this data document.",
    },
    session_uuid: {
      type: "string",
      format: "uuid",
      description:
        "Unique identifier for all activities in this administration of the session. This identifier changes each time a new session starts.",
    },
    activity_uuid: {
      type: "string",
      format: "uuid",
      description:
        "Unique identifier for all trials in this administration of the activity. This identifier changes each time the activity starts.",
    },
    activity_id: {
      type: "string",
      description: "Human-readable identifier of the activity.",
    },
    activity_publish_uuid: {
      type: "string",
      format: "uuid",
      description:
        "Persistent unique identifier of the activity. This identifier never changes. It can be used to identify the activity across different studies and sessions.",
    },
    activity_version: {
      type: "string",
      description: "Version of the activity.",
    },
    device_timezone: {
      type: "string",
      description:
        "Timezone of the device. Calculated from Intl.DateTimeFormat().resolvedOptions().timeZone.",
    },
    device_timezone_offset_minutes: {
      type: "integer",
      description:
        "Difference in minutes between UTC and device timezone. Calculated from Date.getTimezoneOffset().",
    },
    locale: {
      type: ["string", "null"],
      description:
        "Locale of the trial. null if the activity does not support localization.",
    },
  };

  /**
   * The m2c2kit engine will automatically include these schema and their
   * values in the scoring data.
   *
   * @remarks These are in the `Game` class, rather than in the `DataManager`
   * class, because the schema-util parses the code to find these
   * properties, and it expects them in the `Game` class.
   */
  private readonly automaticScoringSchema: ScoringSchema = {
    data_type: {
      type: "string",
      description: "Type of data.",
    },
    study_id: {
      type: ["string", "null"],
      description:
        "The short human-readable text ID of the study (protocol, experiment, or other aggregate) that contains the administration of this activity.",
    },
    study_uuid: {
      type: ["string", "null"],
      format: "uuid",
      description:
        "Unique identifier of the study (protocol, experiment, or other aggregate) that contains the administration of this activity.",
    },
    document_uuid: {
      type: "string",
      format: "uuid",
      description: "Unique identifier for this data document.",
    },
    session_uuid: {
      type: "string",
      format: "uuid",
      description:
        "Unique identifier for all activities in this administration of the session. This identifier changes each time a new session starts.",
    },
    activity_uuid: {
      type: "string",
      format: "uuid",
      description:
        "Unique identifier for all trials in this administration of the activity. This identifier changes each time the activity starts.",
    },
    activity_id: {
      type: "string",
      description: "Human-readable identifier of the activity.",
    },
    activity_publish_uuid: {
      type: "string",
      format: "uuid",
      description:
        "Persistent unique identifier of the activity. This identifier never changes. It can be used to identify the activity across different studies and sessions.",
    },
    activity_version: {
      type: "string",
      description: "Version of the activity.",
    },
    device_timezone: {
      type: "string",
      description:
        "Timezone of the device. Calculated from Intl.DateTimeFormat().resolvedOptions().timeZone.",
    },
    device_timezone_offset_minutes: {
      type: "integer",
      description:
        "Difference in minutes between UTC and device timezone. Calculated from Date.getTimezoneOffset().",
    },
    locale: {
      type: ["string", "null"],
      description:
        "Locale of the trial. null if the activity does not support localization.",
    },
  };

  /**
   * Queries the WebGL renderer for graphics drivers information and stores
   * it so it can be included in the device metadata.
   *
   * @remarks This method should be called once during the game start to avoid
   * performance issues (it could be slow on some devices/browsers).
   */
  queryWebGlRendererInfo() {
    try {
      this.webGlRendererInfo = WebGlInfo.getRendererString();
    } catch {
      this.webGlRendererInfo = "err";
    } finally {
      WebGlInfo.dispose();
    }
  }

  private propertySchemaDataTypeIsValid(
    propertySchemaType: JsonSchemaDataType | JsonSchemaDataType[],
  ): boolean {
    const validDataTypes = [
      "string",
      "number",
      "integer",
      "object",
      "array",
      "boolean",
      "null",
    ];
    if (typeof propertySchemaType === "string") {
      return validDataTypes.includes(propertySchemaType);
    }
    let dataTypeIsValid = true;
    if (Array.isArray(propertySchemaType)) {
      propertySchemaType.forEach((element) => {
        if (!validDataTypes.includes(element)) {
          dataTypeIsValid = false;
        }
      });
    } else {
      throw new M2Error(`Invalid data type: ${propertySchemaType}`);
    }
    return dataTypeIsValid;
  }

  /**
   * Increments the trial index by 1.
   */
  incrementTrialIndex(): void {
    this.trialIndex = this.trialIndex + 1;
  }

  /**
   * Adds data to the game's TrialData object.
   *
   * @remarks `variableName` must be previously defined in the
   * {@link TrialSchema} object in {@link GameOptions}. The type of the value
   * must match what was defined in the trial schema, otherwise an error is
   * thrown.
   *
   * @param variableName - variable to be set
   * @param value - value of the variable to set
   */
  addTrialData(
    variableName: string,
    value: JsonSchemaDataTypeScriptTypes,
  ): void {
    if (!this.game.options.trialSchema) {
      throw new M2Error(
        "no trial schema were provided in GameOptions. cannot add trial data",
      );
    }

    if (this.data.trials.length < this.trialIndex + 1) {
      const emptyTrial: TrialData = {};
      const variables = Object.entries(this.game.options.trialSchema);
      for (const [variableName] of variables) {
        emptyTrial[variableName] = null;
      }
      this.data.trials.push({
        data_type: "trial",
        document_uuid: Uuid.generate(),
        study_id: this.game.studyId ?? null,
        study_uuid: this.game.studyUuid ?? null,
        session_uuid: this.game.sessionUuid,
        activity_uuid: this.game.uuid,
        activity_id: this.game.options.id,
        activity_publish_uuid: this.game.options.publishUuid,
        activity_version: this.game.options.version,
        device_timezone:
          Intl?.DateTimeFormat()?.resolvedOptions()?.timeZone ?? "",
        device_timezone_offset_minutes: new Date().getTimezoneOffset(),
        locale: this.game.i18n?.locale ?? null,
        ...emptyTrial,
        device_metadata: this.getDeviceMetadata(),
      });
    }
    if (!(variableName in this.game.options.trialSchema)) {
      throw new M2Error(`trial variable ${variableName} not defined in schema`);
    }

    let expectedDataTypes: string[];

    if (Array.isArray(this.game.options.trialSchema[variableName].type)) {
      expectedDataTypes = this.game.options.trialSchema[variableName]
        .type as Array<JsonSchemaDataType>;
    } else {
      expectedDataTypes = [
        this.game.options.trialSchema[variableName].type as string,
      ];
    }

    let providedDataType = typeof value as string;
    // in JavaScript, typeof an array returns "object"!
    // Therefore, do some extra checking to see if we have an array
    if (providedDataType === "object") {
      if (Object.prototype.toString.call(value) === "[object Array]") {
        providedDataType = "array";
      }
    }
    if (value === undefined || value === null) {
      providedDataType = "null";
    }
    if (
      !expectedDataTypes.includes(providedDataType) &&
      !(
        providedDataType === "number" &&
        Number.isInteger(value) &&
        expectedDataTypes.includes("integer")
      )
    ) {
      throw new M2Error(
        `type for variable ${variableName} (value: ${value}) is "${providedDataType}". Based on schema for this variable, expected type was "${expectedDataTypes}"`,
      );
    }
    this.data.trials[this.trialIndex][variableName] = value;
  }

  /**
   * Sets the value of a variable that will be the same for all trials.
   *
   * @remarks This sets the value of a variable that is the same across
   * all trials ("static"). This is useful for variables that are not
   * part of the trial schema, but that you want to save for each trial in
   * your use case. For example, you might want to save the subject's
   * participant ID for each trial, but this is not part of the trial schema.
   * Rather than modify the source code for the game, you can do the following
   * to ensure that the participant ID is saved for each trial:
   *
   *   game.addTrialSchema(&#123
   *     participant_id: &#123
   *       type: "string",
   *       description: "ID of the participant",
   *     &#125;
   *   &#125;);
   *   game.addStaticTrialData("participant_id", "12345");
   *
   *  When Game.trialComplete() is called, the participant_id variable will
   *  be saved for the trial with the value "12345".
   *
   * @param variableName - variable to be set
   * @param value - value of the variable to set
   */
  addStaticTrialData(
    variableName: string,
    value: JsonSchemaDataTypeScriptTypes,
  ) {
    if (!this.game.options.trialSchema) {
      throw new M2Error("trial schema is undefined");
    }
    if (this.game.options.trialSchema[variableName] === undefined) {
      throw new M2Error(`trial variable ${variableName} not defined in schema`);
    }
    this.staticTrialSchema[variableName] = value;
  }

  /**
   * Adds data to the game's scoring data.
   *
   * @remarks The variable name (or object property names) must be previously
   * defined in the {@link ScoringSchema} object in {@link GameOptions}.
   * The type of the value must match what was defined in the scoring schema,
   * otherwise an error is thrown.
   *
   * @param variableNameOrObject - Either a variable name (string) or an object
   * containing multiple key-value pairs to add all at once.
   * @param value - Value of the variable to set (only used when
   * variableNameOrObject is a variable name string).
   */
  addScoringData(
    variableNameOrObject:
      | string
      | Record<string, JsonSchemaDataTypeScriptTypes>
      | Array<Record<string, JsonSchemaDataTypeScriptTypes>>,
    value?: JsonSchemaDataTypeScriptTypes,
  ): void {
    if (!this.game.options.scoringSchema) {
      throw new M2Error(
        "no scoring schema were provided in GameOptions. cannot add scoring data",
      );
    }

    // Initialize scoring data structure if empty
    if (Object.keys(this.data.scoring).length === 0) {
      const emptyScoring: ActivityKeyValueData = {
        data_type: "scoring",
        document_uuid: Uuid.generate(),
        study_id: this.game.studyId ?? null,
        study_uuid: this.game.studyUuid ?? null,
        session_uuid: this.game.sessionUuid,
        activity_uuid: this.game.uuid,
        activity_id: this.game.options.id,
        activity_publish_uuid: this.game.options.publishUuid,
        activity_version: this.game.options.version,
        device_timezone:
          Intl?.DateTimeFormat()?.resolvedOptions()?.timeZone ?? "",
        device_timezone_offset_minutes: new Date().getTimezoneOffset(),
        locale: this.game.i18n?.locale ?? null,
        device_metadata: this.getDeviceMetadata(),
      };
      const variables = Object.entries(this.game.options.scoringSchema);
      for (const [variableName] of variables) {
        emptyScoring[variableName] = null;
      }
      this.data.scoring = emptyScoring;
    }

    // Handle bulk add (object of key-value pairs)
    if (typeof variableNameOrObject === "object") {
      let scoringObject: Record<string, JsonSchemaDataTypeScriptTypes>;
      if (Array.isArray(variableNameOrObject)) {
        if (variableNameOrObject.length !== 1) {
          console.warn(
            `Array of objects passed to addScoringData() is length ${variableNameOrObject.length}. This is likely an error in the assessment's code for calculateScores().`,
          );
        }
        scoringObject = variableNameOrObject[0];
      } else {
        scoringObject = variableNameOrObject;
      }
      for (const [key, val] of Object.entries(scoringObject)) {
        this.validateAndSetScoringVariable(key, val);
      }
      return;
    }

    // Handle single variable
    const variableName = variableNameOrObject;
    if (value === undefined) {
      throw new M2Error(
        "Value must be provided when adding a single scoring variable",
      );
    }
    this.validateAndSetScoringVariable(variableName, value);
  }

  /**
   * Helper method to validate and set a single scoring variable
   *
   * @param variableName - Name of the variable to set
   * @param value - Value to set
   * @private
   */
  private validateAndSetScoringVariable(
    variableName: string,
    value: JsonSchemaDataTypeScriptTypes,
  ): void {
    if (!this.game.options.scoringSchema) {
      throw new M2Error(
        "no scoring schema were provided in GameOptions. cannot add scoring data",
      );
    }

    if (!(variableName in this.game.options.scoringSchema)) {
      throw new M2Error(
        `scoring variable ${variableName} not defined in schema`,
      );
    }

    let expectedDataTypes: string[];

    if (Array.isArray(this.game.options.scoringSchema[variableName].type)) {
      expectedDataTypes = this.game.options.scoringSchema[variableName]
        .type as Array<JsonSchemaDataType>;
    } else {
      expectedDataTypes = [
        this.game.options.scoringSchema[variableName].type as string,
      ];
    }

    let providedDataType = typeof value as string;
    // Check if object is actually an array
    if (providedDataType === "object") {
      if (Object.prototype.toString.call(value) === "[object Array]") {
        providedDataType = "array";
      }
    }
    if (value === undefined || value === null) {
      providedDataType = "null";
    }
    if (
      !expectedDataTypes.includes(providedDataType) &&
      !(
        providedDataType === "number" &&
        Number.isInteger(value) &&
        expectedDataTypes.includes("integer")
      )
    ) {
      throw new M2Error(
        `type for variable ${variableName} (value: ${value}) is "${providedDataType}". Based on schema for this variable, expected type was "${expectedDataTypes}"`,
      );
    }
    this.data.scoring[variableName] = value;
  }

  getDeviceMetadata(): DeviceMetadata {
    const screen = window.screen;
    if (!screen.orientation) {
      // we're likely running unit tests in node, so
      // screen.orientation was not available and not mocked
      return {
        userAgent: navigator.userAgent,
        devicePixelRatio: window.devicePixelRatio,
        screen: {
          availHeight: screen.availHeight,
          availWidth: screen.availWidth,
          colorDepth: screen.colorDepth,
          height: screen.height,
          pixelDepth: screen.pixelDepth,
          width: screen.width,
        },
        webGlRenderer: this.webGlRendererInfo,
      };
    }
    return {
      userAgent: navigator.userAgent,
      devicePixelRatio: window.devicePixelRatio,
      screen: {
        availHeight: screen.availHeight,
        availWidth: screen.availWidth,
        colorDepth: screen.colorDepth,
        height: screen.height,
        orientation: {
          type: screen.orientation.type,
          angle: screen.orientation.angle,
        },
        pixelDepth: screen.pixelDepth,
        width: screen.width,
      },
      webGlRenderer: this.webGlRendererInfo,
    };
  }

  makeNewGameDataSchema(): JsonSchema {
    // return schema as JSON Schema draft 2019-09
    const newDataSchema: JsonSchema = {
      description: `A single trial and metadata from the assessment ${this.game.name}.`,
      $comment: `Activity identifier: ${this.game.options.id}, version: ${this.game.options.version}.`,
      $schema: "https://json-schema.org/draft/2019-09/schema",
      type: "object",
      properties: {
        ...this.automaticTrialSchema,
        ...this.game.options.trialSchema,
        device_metadata: deviceMetadataSchema,
      },
    };
    return newDataSchema;
  }

  makeGameDataSchema(): JsonSchema {
    const dataSchema: JsonSchema = {
      description: `All trials and metadata from the assessment ${this.game.name}.`,
      $comment: `Activity identifier: ${this.game.options.id}, version: ${this.game.options.version}.`,
      $schema: "https://json-schema.org/draft/2019-09/schema",
      type: "object",
      required: ["trials"],
      properties: {
        trials: {
          type: "array",
          items: { $ref: "#/$defs/trial" },
          description: "All trials from the assessment.",
        },
      },
      $defs: {
        trial: {
          type: "object",
          properties: {
            ...this.automaticTrialSchema,
            ...this.game.options.trialSchema,
            device_metadata: deviceMetadataSchema,
          },
        },
      },
    };
    return dataSchema;
  }

  makeScoringDataSchema(): JsonSchema {
    // return schema as JSON Schema draft 2019-09
    const scoringDataSchema: JsonSchema = {
      description: `Scoring data and metadata from the assessment ${this.game.name}.`,
      $comment: `Activity identifier: ${this.game.options.id}, version: ${this.game.options.version}.`,
      $schema: "https://json-schema.org/draft/2019-09/schema",
      type: "object",
      properties: {
        ...this.automaticScoringSchema,
        ...this.game.options.scoringSchema,
        device_metadata: deviceMetadataSchema,
      },
    };
    return scoringDataSchema;
  }

  private validateSchema(schema: TrialSchema | ScoringSchema) {
    const variables = Object.entries(schema);
    for (const [variableName, propertySchema] of variables) {
      if (
        propertySchema.type !== undefined &&
        !this.propertySchemaDataTypeIsValid(propertySchema.type)
      ) {
        throw new M2Error(
          `invalid schema. variable ${variableName} is type ${propertySchema.type}. type must be number, string, boolean, object, or array`,
        );
      }
    }
  }
}
