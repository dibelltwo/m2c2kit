import {
  Game,
  Action,
  Scene,
  Shape,
  Label,
  Transition,
  TransitionDirection,
  WebColors,
  RandomDraws,
  GameParameters,
  GameOptions,
  TrialSchema,
  Timer,
  Easings,
  RgbaColor,
  Equal,
  Sprite,
  Point,
  Constants,
  Translation,
  LabelHorizontalAlignmentMode,
  M2Error,
  ScoringProvider,
  ActivityKeyValueData,
  ScoringSchema,
} from "@m2c2kit/core";
import {
  Button,
  CountdownScene,
  Grid,
  Instructions,
  InstructionsOptions,
  LocalePicker,
} from "@m2c2kit/addons";
import {
  arrange,
  DataCalc,
  filter,
  median,
  sum,
  scalar,
} from "@m2c2kit/data-calc";

/**
 * Color Dots is cued-recall, item-location memory binding task, where after
 * viewing 3 dots for a brief period of time, participants report: (1) the
 * color at a cued location; (2) the location of a cued color.
 */
class ColorDots extends Game implements ScoringProvider {
  constructor() {
    /**
     * These are configurable game parameters and their defaults.
     * Each game parameter should have a type, default (this is the default
     * value), and a description.
     */
    const defaultParameters: GameParameters = {
      fixation_duration_ms: {
        default: 500,
        description: "How long fixation scene is shown, milliseconds.",
        type: "number",
      },
      dot_colors: {
        type: "array",
        description: "Array of colors for dots.",
        items: {
          type: "object",
          properties: {
            colorName: {
              type: "string",
              description: "Human-friendly name of color.",
            },
            rgbaColor: {
              type: "array",
              description: "Color as array, [r,g,b,a].",
              items: {
                type: "number",
              },
            },
          },
        },
        default: [
          { colorName: "black", rgbaColor: [0, 0, 0, 1] },
          { colorName: "green", rgbaColor: [0, 158, 115, 1] },
          { colorName: "yellow", rgbaColor: [240, 228, 66, 1] },
          { colorName: "blue", rgbaColor: [0, 114, 178, 1] },
          { colorName: "orange", rgbaColor: [213, 94, 0, 1] },
          { colorName: "pink", rgbaColor: [204, 121, 167, 1] },
          // These two additional colors were in the original specification
          // but not implemented: [230, 159, 0, 1], [86, 180, 233, 1]
        ],
      },
      dot_diameter: {
        default: 48,
        description: "Diameter of dots.",
        type: "number",
      },
      number_of_dots: {
        default: 3,
        description: "How many dots to present. Must be at least 3.",
        type: "integer",
      },
      dot_present_duration_ms: {
        default: 1000,
        description: "How long the dots are shown, milliseconds.",
        type: "number",
      },
      dot_blank_duration_ms: {
        default: 750,
        description:
          "How long to show a blank square after dots are removed, milliseconds.",
        type: "number",
      },
      color_selected_hold_duration_ms: {
        default: 500,
        description:
          "How long to show a square with the dot colored by the user's choice, before advancing to next scene, milliseconds.",
        type: "number",
      },
      number_of_trials: {
        default: 5,
        description: "How many trials to run.",
        type: "integer",
      },
      show_trials_complete_scene: {
        default: true,
        type: "boolean",
        description:
          "After the final trial, should a completion scene be shown? Otherwise, the game will immediately end.",
      },
      instruction_type: {
        default: "long",
        description: "Type of instructions to show, 'short' or 'long'.",
        type: "string",
        enum: ["short", "long"],
      },
      instructions: {
        default: null,
        type: ["object", "null"],
        description:
          "When non-null, an InstructionsOptions object that will completely override the built-in instructions.",
      },
      show_quit_button: {
        type: "boolean",
        default: false,
        description: "Should the activity quit button be shown?",
      },
      show_fps: {
        type: "boolean",
        default: false,
        description: "Should the FPS be shown?",
      },
      show_locale_picker: {
        type: "boolean",
        default: false,
        description:
          "Should the icon that allows the participant to switch the locale be shown?",
      },
      seed: {
        type: ["string", "null"],
        default: null,
        description:
          "Optional seed for the seeded pseudo-random number generator. When null, the default Math.random() is used.",
      },
      scoring: {
        type: "boolean",
        default: false,
        description: "Should scoring data be generated? Default is false.",
      },
      scoring_filter_response_time_duration_ms: {
        type: "array",
        items: {
          type: "number",
        },
        default: [100, 10000],
        description:
          "When scoring, values of response_time_duration_ms less than the lower bound or greater than the upper bound are discarded. This array contains two numbers, the lower and upper bounds.",
      },
    };

    /**
     * This describes all the data that will be generated by the assessment.
     * At runtime, when a trial completes, the data will be returned to the
     * session with a callback, along with this schema transformed into
     * JSON Schema.
     */
    const colorDotsTrialSchema: TrialSchema = {
      activity_begin_iso8601_timestamp: {
        type: "string",
        format: "date-time",
        description:
          "ISO 8601 timestamp at the beginning of the game activity.",
      },
      trial_begin_iso8601_timestamp: {
        type: ["string", "null"],
        format: "date-time",
        description:
          "ISO 8601 timestamp at the beginning of the trial. Null if trial was skipped.",
      },
      trial_end_iso8601_timestamp: {
        type: ["string", "null"],
        format: "date-time",
        description:
          "ISO 8601 timestamp at the end of the trial (when user presses 'Done' after placing the dot). Null if trial was skipped.",
      },
      trial_index: {
        type: ["integer", "null"],
        description: "Index of the trial within this assessment, 0-based.",
      },
      square_side_length: {
        type: ["number", "null"],
        description:
          "Length of square side, in pixels. This is the square in which the dots are shown. Null if trial was skipped.",
      },
      presented_dots: {
        description:
          "Configuration of dots presented to the user. Null if trial was skipped.",
        type: ["array", "null"],
        items: {
          type: "object",
          properties: {
            color_name: {
              type: "string",
              description: "Human-friendly name of color.",
            },
            rgba_color: {
              type: "array",
              description: "Color as array, [r,g,b,a].",
              items: {
                type: "number",
              },
            },
            location: {
              type: "object",
              description: "Location of dot.",
              properties: {
                x: {
                  type: "number",
                  description: "X coordinate of dot.",
                },
                y: {
                  type: "number",
                  description: "Y coordinate of dot.",
                },
              },
            },
          },
        },
      },
      color_target_dot_index: {
        description:
          "Index (0-based) of presented dot whose color the user was asked to recall. Null if trial was skipped.",
        type: ["integer", "null"],
      },
      color_selected: {
        description: "Color selected by user. Null if trial was skipped.",
        type: ["object", "null"],
        properties: {
          color_name: {
            type: "string",
            description: "Human-friendly name of color.",
          },
          rgba_color: {
            type: "array",
            description: "Color as array, [r,g,b,a].",
            items: {
              type: "number",
            },
          },
        },
      },
      color_selected_correct: {
        type: ["boolean", "null"],
        description:
          "Was the color selected by the user correct? Null if trial was skipped.",
      },
      location_target_dot_index: {
        description:
          "Index (0-based) of presented dot whose location the user was asked to recall. Null if trial was skipped.",
        type: ["integer", "null"],
      },
      location_selected: {
        description: "Location selected by user. Null if trial was skipped.",
        type: ["object", "null"],
        properties: {
          x: {
            type: "number",
            description: "X coordinate of dot.",
          },
          y: {
            type: "number",
            description: "Y coordinate of dot.",
          },
        },
      },
      location_selected_delta: {
        type: ["number", "null"],
        description:
          "Euclidean distance between location target dot and the location selected by user. Null if trial was skipped.",
      },
      color_selection_response_time_ms: {
        type: ["number", "null"],
        description:
          "Milliseconds from the beginning of color selection task until the user taps the done button. Null if trial was skipped.",
      },
      location_selection_response_time_ms: {
        type: ["number", "null"],
        description:
          "Milliseconds from the beginning of location selection task until the user taps the done button. Null if trial was skipped.",
      },
      quit_button_pressed: {
        type: "boolean",
        description: "Was the quit button pressed?",
      },
    };

    const colorDotsScoringSchema: ScoringSchema = {
      activity_begin_iso8601_timestamp: {
        type: "string",
        format: "date-time",
        description:
          "ISO 8601 timestamp at the beginning of the game activity.",
      },
      first_trial_begin_iso8601_timestamp: {
        type: ["string", "null"],
        format: "date-time",
        description:
          "ISO 8601 timestamp at the beginning of the first trial. Null if no trials were completed.",
      },
      last_trial_end_iso8601_timestamp: {
        type: ["string", "null"],
        format: "date-time",
        description:
          "ISO 8601 timestamp at the end of the last trial. Null if no trials were completed.",
      },
      n_trials: {
        type: "integer",
        description: "Number of trials completed.",
      },
      flag_trials_match_expected: {
        type: "integer",
        description:
          "Does the number of completed and expected trials match? 1 = true, 0 = false.",
      },
      flag_trials_lt_expected: {
        type: "number",
        description:
          "Is the number of completed trials fewer than expected? 1 = true, 0 = false.",
      },
      flag_trials_gt_expected: {
        type: "number",
        description:
          "Is the number of completed trials greater than expected? 1 = true, 0 = false.",
      },
      n_trials_color_swap: {
        type: ["number", "null"],
        description:
          "Number of trials where the participant selected the color of a non-target (swap) dot",
      },
      n_trials_location_swap: {
        type: ["number", "null"],
        description:
          "Number of trials where the participant selected the location of a non-target (swap) dot",
      },
      n_responses_swap_total: {
        type: ["number", "null"],
        description:
          "Total number of swap responses across both color and location recall (n_trials_color_swap + n_trials_location_swap)",
      },
      n_trials_color_incorrect: {
        type: ["number", "null"],
        description:
          "Number of trials where the color response was not correct (includes both swaps and random errors)",
      },
      n_trials_location_incorrect: {
        type: ["number", "null"],
        description:
          "Number of trials where the location response was not correct (includes both swaps and random errors)",
      },
      n_responses_incorrect_total: {
        type: ["number", "null"],
        description:
          "Total number of incorrect responses across both color and location recall (n_trials_color_incorrect + n_trials_location_incorrect)",
      },
      n_trials_color_correct: {
        type: ["number", "null"],
        description:
          "Number of trials where the participant correctly recalled the target dot's color",
      },
      n_trials_location_correct: {
        type: ["number", "null"],
        description:
          "Number of trials where the participant correctly recalled the target dot's location (within 75 pixel threshold)",
      },
      n_responses_correct_total: {
        type: ["number", "null"],
        description:
          "Total number of correct responses across both color and location recall (n_trials_color_correct + n_trials_location_correct)",
      },
      median_response_time_color_filtered: {
        type: ["number", "null"],
        description:
          "Median color selection response time (ms) after filtering outliers (RT < 100 ms or RT > 10,000 ms removed)",
      },
      median_response_time_location_filtered: {
        type: ["number", "null"],
        description:
          "Median location selection response time (ms) after filtering outliers (RT < 100 ms or RT > 10,000 ms removed)",
      },
      median_response_time_color_filtered_correct: {
        type: ["number", "null"],
        description:
          "Median color selection response time (ms) for correct color trials only, after filtering outliers",
      },
      median_response_time_location_filtered_correct: {
        type: ["number", "null"],
        description:
          "Median location selection response time (ms) for correct location trials only, after filtering outliers",
      },
      median_response_time_color_filtered_swap: {
        type: ["number", "null"],
        description:
          "Median color selection response time (ms) for swap color trials only, after filtering outliers",
      },
      median_response_time_location_filtered_swap: {
        type: ["number", "null"],
        description:
          "Median location selection response time (ms) for swap location trials only, after filtering outliers",
      },
      median_response_time_color_filtered_incorrect: {
        type: ["number", "null"],
        description:
          "Median color selection response time (ms) for all incorrect (swap + random) color trials, after filtering outliers",
      },
      median_response_time_location_filtered_incorrect: {
        type: ["number", "null"],
        description:
          "Median location selection response time (ms) for all incorrect (swap + random) location trials, after filtering outliers",
      },
      participant_score: {
        type: ["number", "null"],
        description:
          "Participant-facing score. It is a weighted score of color identification and location accuracy. This is a simple metric to provide feedback to the participant. Null if no trials attempted.",
      },
    };

    const translation: Translation = {
      configuration: {
        baseLocale: "en-US",
      },
      "en-US": {
        localeName: "English",
        INSTRUCTIONS_TITLE: "Color Dots",
        SHORT_INSTRUCTIONS_TEXT_PAGE_1:
          "For this activity, try to remember the location and color of 3 dots.",
        INSTRUCTIONS_TEXT_PAGE_1:
          "For this activity, try to remember the location and color of 3 dots.",
        INSTRUCTIONS_TEXT_PAGE_2:
          "Choose the color of the dot from the options at the bottom of the screen.",
        INSTRUCTIONS_TEXT_PAGE_3:
          "Next you are asked to place another dot. Touch the screen where you remember seeing the dot.",
        WHAT_COLOR: "What color was this dot?",
        WHERE_WAS: "Where was this dot?",
        TOUCH_TO_MOVE: "Touch the screen to move the dot",
        DONE_BUTTON_TEXT: "Done",
        START_BUTTON_TEXT: "START",
        NEXT_BUTTON_TEXT: "Next",
        BACK_BUTTON_TEXT: "Back",
        GET_READY_COUNTDOWN_TEXT: "GET READY!",
        TRIALS_COMPLETE_SCENE_TEXT: "This activity is complete.",
        TRIALS_COMPLETE_SCENE_BUTTON_TEXT: "OK",
      },
      // cSpell:disable (for VS Code extension, Code Spell Checker)
      "es-MX": {
        localeName: "Español",
        INSTRUCTIONS_TITLE: "Puntos de Color",
        SHORT_INSTRUCTIONS_TEXT_PAGE_1:
          "Para esta actividad, intenta recordar la ubicación y el color de 3 puntos.",
        INSTRUCTIONS_TEXT_PAGE_1:
          "Para esta actividad, intenta recordar la ubicación y el color de 3 puntos.",
        INSTRUCTIONS_TEXT_PAGE_2:
          "Escoja el color del punto de las opciones en la parte de abajo de la pantalla.",
        INSTRUCTIONS_TEXT_PAGE_3:
          "Luego, se te pedirá que coloques otro punto. Toca la pantalla donde recuerdas haber visto el punto.",
        WHAT_COLOR: "¿De qué color era este punto?",
        WHERE_WAS: "¿Dónde estaba este punto?",
        TOUCH_TO_MOVE: "Toca la pantalla para mover el punto",
        DONE_BUTTON_TEXT: "Listo",
        START_BUTTON_TEXT: "COMENZAR",
        NEXT_BUTTON_TEXT: "Siguiente",
        BACK_BUTTON_TEXT: "Atrás",
        GET_READY_COUNTDOWN_TEXT: "PREPÁRESE",
        TRIALS_COMPLETE_SCENE_TEXT: "Esta actividad está completa.",
        TRIALS_COMPLETE_SCENE_BUTTON_TEXT: "OK",
      },
      // cSpell:enable
    };

    const options: GameOptions = {
      name: "Color Dots",
      /**
       * This id must match the property m2c2kit.assessmentId in package.json
       */
      id: "color-dots",
      publishUuid: "72a1ef60-75c0-47b3-921c-aaee72cca9da",
      version: "__PACKAGE_JSON_VERSION__",
      moduleMetadata: Constants.MODULE_METADATA_PLACEHOLDER,
      translation: translation,
      shortDescription:
        "Color Dots is cued-recall, item-location memory \
binding task, where after viewing 3 dots for a brief period of time, \
participants report: (1) the color at a cued location; (2) the location of \
a cued color.",
      longDescription:
        "Participants are asked to remember the location and color of three \
briefly presented, and uniquely colored dots. Each trial of this task \
requires two responses (subsequently referred to as stage 1 and stage 2 in \
the list of outcome variables): (1) reporting the color at a cued location; \
(2) reporting the location where a circular of a specified color previously \
appeared.",
      showFps: defaultParameters.show_fps.default,
      width: 400,
      height: 800,
      bodyBackgroundColor: WebColors.White,
      trialSchema: colorDotsTrialSchema,
      scoringSchema: colorDotsScoringSchema,
      parameters: defaultParameters,
      fonts: [
        {
          fontName: "roboto",
          url: "fonts/roboto/Roboto-Regular.ttf",
        },
      ],
      images: [
        {
          imageName: "cd1",
          height: 450,
          width: 350,
          url: "images/cd1.png",
        },
        {
          imageName: "cd2",
          height: 450,
          width: 350,
          url: "images/cd2.png",
          localize: true,
        },
        {
          imageName: "cd3",
          height: 450,
          width: 350,
          url: "images/cd3.png",
          localize: true,
        },
        {
          imageName: "circle-x",
          height: 32,
          width: 32,
          // the svg is from evericons and is licensed under CC0 1.0
          // Universal (Public Domain). see https://www.patreon.com/evericons
          url: "images/circle-x.svg",
        },
      ],
    };

    super(options);
  }

  override async initialize() {
    await super.initialize();
    // just for convenience, alias the variable game to "this"
    // (even though eslint doesn't like it)
    // eslint-disable-next-line @typescript-eslint/no-this-alias
    const game = this;

    const seed = game.getParameter<string | null>("seed");
    if (typeof seed === "string") {
      RandomDraws.setSeed(seed);
    }

    const SQUARE_SIDE_LENGTH = 350;

    // ==============================================================

    if (game.getParameter<boolean>("show_quit_button")) {
      const quitSprite = new Sprite({
        imageName: "circle-x",
        position: { x: 380, y: 20 },
        isUserInteractionEnabled: true,
      });
      game.addFreeNode(quitSprite);
      quitSprite.onTapDown((e) => {
        game.removeAllFreeNodes();
        e.handled = true;
        const blankScene = new Scene();
        game.addScene(blankScene);
        game.presentScene(blankScene);
        game.addTrialData("quit_button_pressed", true);
        game.trialComplete();
        if (game.getParameter<boolean>("scoring")) {
          // Score the data only if user does not quit. If user quits, pass
          // empty data to calculateScores so a "blank" set of scores is
          // generated.
          const scores = game.calculateScores([], {
            rtLowerBound: game.getParameter<Array<number>>(
              "scoring_filter_response_time_duration_ms",
            )[0],
            rtUpperBound: game.getParameter<Array<number>>(
              "scoring_filter_response_time_duration_ms",
            )[1],
            numberOfTrials: game.getParameter<number>("number_of_trials"),
            dotDiameter: game.getParameter<number>("dot_diameter"),
          });
          game.addScoringData(scores);
          game.scoringComplete();
        }
        game.cancel();
      });
    }

    let localePicker: LocalePicker;
    if (game.getParameter<boolean>("show_locale_picker")) {
      localePicker = new LocalePicker();
      game.addFreeNode(localePicker);
    }

    // ==============================================================
    // These user input variables are referenced across scenes, thus
    // we must define them in this scope, rather than in the
    // scene.onSetup() function.
    interface ColorSelected {
      color_name: string;
      rgba_color: RgbaColor;
    }
    let colorSelected: ColorSelected;
    let selectedRgba: RgbaColor | undefined;

    // ==============================================================
    // SCENES: instructions
    let instructionsScenes: Array<Scene>;

    const customInstructions = game.getParameter<InstructionsOptions | null>(
      "instructions",
    );
    if (customInstructions) {
      instructionsScenes = Instructions.create(customInstructions);
    } else {
      switch (game.getParameter("instruction_type")) {
        case "short": {
          instructionsScenes = Instructions.create({
            instructionScenes: [
              {
                title: "INSTRUCTIONS_TITLE",
                text: "SHORT_INSTRUCTIONS_TEXT_PAGE_1",
                imageName: "cd1",
                imageAboveText: false,
                textFontSize: 24,
                titleFontSize: 30,
                textVerticalBias: 0.2,
                nextButtonText: "START_BUTTON_TEXT",
                nextButtonBackgroundColor: WebColors.Green,
              },
            ],
          });
          break;
        }
        case "long": {
          instructionsScenes = Instructions.create({
            instructionScenes: [
              {
                title: "INSTRUCTIONS_TITLE",
                text: "INSTRUCTIONS_TEXT_PAGE_1",
                imageName: "cd1",
                imageAboveText: false,
                textFontSize: 24,
                titleFontSize: 30,
                textVerticalBias: 0.2,
                nextButtonText: "NEXT_BUTTON_TEXT",
                backButtonText: "BACK_BUTTON_TEXT",
              },
              {
                title: "INSTRUCTIONS_TITLE",
                text: "INSTRUCTIONS_TEXT_PAGE_2",
                imageName: "cd2",
                imageAboveText: false,
                textFontSize: 24,
                titleFontSize: 30,
                textVerticalBias: 0.15,
                nextButtonText: "NEXT_BUTTON_TEXT",
                backButtonText: "BACK_BUTTON_TEXT",
              },
              {
                title: "INSTRUCTIONS_TITLE",
                text: "INSTRUCTIONS_TEXT_PAGE_3",
                imageName: "cd3",
                imageAboveText: false,
                imageMarginTop: 8,
                textFontSize: 24,
                titleFontSize: 30,
                textVerticalBias: 0.15,
                nextButtonText: "START_BUTTON_TEXT",
                nextButtonBackgroundColor: WebColors.Green,
                backButtonText: "BACK_BUTTON_TEXT",
              },
            ],
          });
          break;
        }
        default: {
          throw new M2Error("invalid value for instruction_type");
        }
      }
    }
    instructionsScenes[0].onAppear(() => {
      // in case user quits before starting a trial, record the
      // timestamp
      game.addTrialData(
        "activity_begin_iso8601_timestamp",
        this.beginIso8601Timestamp,
      );
    });
    game.addScenes(instructionsScenes);

    // ==============================================================
    // SCENE: countdown. Show 3 second countdown.
    const countdownScene = new CountdownScene({
      milliseconds: 3000,
      text: "GET_READY_COUNTDOWN_TEXT",
      zeroDwellMilliseconds: 1000,
      transition: Transition.none(),
    });
    game.addScene(countdownScene);

    interface Dot {
      x: number;
      y: number;
      rgbaColor: RgbaColor;
      colorName: string;
    }

    interface ScreenDot extends Dot {
      shape: Shape;
    }

    interface TrialConfiguration {
      dots: Array<Dot>;
      colorSelectionDotIndex: number;
      locationSelectionDotIndex: number;
    }

    const trialConfigurations: Array<TrialConfiguration> = [];
    const numberOfDots = game.getParameter<number>("number_of_dots");
    const dotColors =
      game.getParameter<Array<{ colorName: string; rgbaColor: RgbaColor }>>(
        "dot_colors",
      );
    const dotDiameter = game.getParameter<number>("dot_diameter");
    const numberOfColors = dotColors.length;

    function positionTooCloseToOtherDots(
      x: number,
      y: number,
      dots: Array<Dot>,
    ) {
      for (let i = 0; i < dots.length; i++) {
        const dist = Math.sqrt(
          Math.pow(x - dots[i].x, 2) + Math.pow(y - dots[i].y, 2),
        );
        if (dist < dotDiameter * 3 + 0.25 * dotDiameter) {
          return true;
        }
      }
      return false;
    }

    for (let i = 0; i < game.getParameter<number>("number_of_trials"); i++) {
      // we clone the dotColors array because we mutate the cloned array
      // (availableColors) to avoid re-using colors in the same trial
      const availableColors: { colorName: string; rgbaColor: RgbaColor }[] =
        JSON.parse(JSON.stringify(dotColors));
      const dots = new Array<Dot>();
      for (let j = 0; j < numberOfDots; j++) {
        let x: number;
        let y: number;
        do {
          // +4, -4 to have some small margin between dot and square
          x = RandomDraws.singleFromRange(
            0 + dotDiameter / 2 + 4,
            SQUARE_SIDE_LENGTH - dotDiameter / 2 - 4,
          );
          y = RandomDraws.singleFromRange(
            0 + dotDiameter / 2 + 4,
            SQUARE_SIDE_LENGTH - dotDiameter / 2 - 4,
          );
        } while (positionTooCloseToOtherDots(x, y, dots));

        const colorIndex = RandomDraws.singleFromRange(
          0,
          availableColors.length - 1,
        );
        const dotColor = availableColors.splice(colorIndex, 1)[0];
        const dot = {
          x,
          y,
          rgbaColor: dotColor.rgbaColor,
          colorName: dotColor.colorName,
        };
        dots.push(dot);
      }

      const colorSelectionDotIndex = RandomDraws.singleFromRange(
        0,
        dots.length - 1,
      );

      trialConfigurations.push({
        colorSelectionDotIndex: colorSelectionDotIndex,
        // which dot is chosen for the location selection task is not yet
        // known, because it depends on user input to color selection task.
        locationSelectionDotIndex: NaN,
        dots: dots,
      });
    }

    // ==============================================================
    // SCENE: fixation. Show cross, then advance after XXXX
    // milliseconds (as defined in fixation_duration_ms parameter)
    const fixationScene = new Scene();
    game.addScene(fixationScene);

    const fixationSceneSquare = new Shape({
      rect: { size: { width: SQUARE_SIDE_LENGTH, height: SQUARE_SIDE_LENGTH } },
      fillColor: WebColors.Transparent,
      strokeColor: WebColors.Gray,
      lineWidth: 4,
      position: { x: 200, y: 300 },
    });
    fixationScene.addChild(fixationSceneSquare);

    const plusLabel = new Label({
      text: "+",
      fontSize: 32,
      fontColor: WebColors.Black,
      localize: false,
    });
    fixationSceneSquare.addChild(plusLabel);

    fixationScene.onSetup(() => {
      fixationScene.run(
        Action.sequence([
          Action.wait({ duration: game.getParameter("fixation_duration_ms") }),
          Action.custom({
            callback: () => {
              game.presentScene(dotPresentationScene);
            },
          }),
        ]),
      );
    });

    fixationScene.onAppear(() => {
      game.addTrialData(
        "activity_begin_iso8601_timestamp",
        this.beginIso8601Timestamp,
      );
      game.addTrialData(
        "trial_begin_iso8601_timestamp",
        new Date().toISOString(),
      );
    });

    // ==============================================================
    // SCENE: dotPresentation.
    const dotPresentationScene = new Scene();
    game.addScene(dotPresentationScene);

    const dotPresentationSceneSquare = new Shape({
      rect: { size: { width: SQUARE_SIDE_LENGTH, height: SQUARE_SIDE_LENGTH } },
      fillColor: WebColors.Transparent,
      strokeColor: WebColors.Gray,
      lineWidth: 4,
      position: { x: 200, y: 300 },
    });
    dotPresentationScene.addChild(dotPresentationSceneSquare);

    const screenDots = new Array<ScreenDot>();

    dotPresentationScene.onSetup(() => {
      screenDots.length = 0;
      const trialConfiguration = trialConfigurations[game.trialIndex];

      for (const dot of trialConfiguration.dots) {
        const screenDot: ScreenDot = {
          x: dot.x,
          y: dot.y,
          rgbaColor: dot.rgbaColor,
          colorName: dot.colorName,
          shape: new Shape({
            circleOfRadius: dotDiameter / 2,
            fillColor: dot.rgbaColor,
            position: {
              x: dot.x - SQUARE_SIDE_LENGTH / 2,
              y: dot.y - SQUARE_SIDE_LENGTH / 2,
            },
          }),
        };
        screenDots.push(screenDot);
        dotPresentationSceneSquare.addChild(screenDot.shape);
      }

      dotPresentationScene.run(
        Action.sequence([
          Action.wait({
            duration: game.getParameter("dot_present_duration_ms"),
          }),
          Action.custom({
            callback: () => {
              dotPresentationSceneSquare.removeAllChildren();
            },
          }),
          Action.wait({ duration: game.getParameter("dot_blank_duration_ms") }),
          Action.custom({
            callback: () => {
              game.presentScene(colorSelectionScene);
            },
          }),
        ]),
      );
    });

    // ==============================================================
    // SCENE: colorSelection
    const colorSelectionScene = new Scene();
    game.addScene(colorSelectionScene);

    const colorSelectionSceneSquare = new Shape({
      rect: { size: { width: SQUARE_SIDE_LENGTH, height: SQUARE_SIDE_LENGTH } },
      fillColor: WebColors.Transparent,
      strokeColor: WebColors.Gray,
      lineWidth: 4,
      position: { x: 200, y: 300 },
    });
    colorSelectionScene.addChild(colorSelectionSceneSquare);

    const whatColorLabel = new Label({
      text: "WHAT_COLOR",
      fontSize: 24,
      position: { x: 200, y: 75 },
    });
    colorSelectionScene.addChild(whatColorLabel);

    const colorPaletteOutline = new Shape({
      position: { x: 200, y: 530 },
      fillColor: WebColors.Transparent,
      strokeColor: WebColors.Black,
      lineWidth: 2,
      rect: { width: 350, height: 60 },
    });
    colorSelectionScene.addChild(colorPaletteOutline);

    const colorPaletteGrid = new Grid({
      position: { x: 200, y: 530 },
      rows: 1,
      columns: numberOfColors,
      size: { width: 350, height: 60 },
      backgroundColor: WebColors.Transparent,
      gridLineColor: WebColors.Transparent,
    });

    colorSelectionScene.addChild(colorPaletteGrid);

    let colorRt = -1;

    const colorSelectionDoneButton = new Button({
      position: { x: 200, y: 650 },
      text: "DONE_BUTTON_TEXT",
      hidden: true,
    });
    colorSelectionDoneButton.onTapDown(() => {
      Timer.stop("colorRt");
      colorRt = Timer.elapsed("colorRt");
      Timer.remove("colorRt");
      game.addTrialData("color_selection_response_time_ms", colorRt);
      whatColorLabel.hidden = true;
      colorPaletteOutline.hidden = true;
      colorPaletteGrid.hidden = true;
      colorSelectionDoneButton.hidden = true;
      colorSelectionDoneButton.run(
        Action.sequence([
          Action.wait({
            duration: game.getParameter("color_selected_hold_duration_ms"),
          }),
          Action.custom({
            callback: () => {
              if (!selectedRgba) {
                throw new M2Error("no selected color");
              }
              const colorSelectedName = dotColors.filter((d) =>
                Equal.rgbaColor(d.rgbaColor, selectedRgba),
              )[0].colorName;
              colorSelected = {
                color_name: colorSelectedName,
                rgba_color: selectedRgba,
              };
              game.addTrialData("color_selected", colorSelected);
              const trialConfiguration = trialConfigurations[game.trialIndex];
              const colorTargetDot =
                trialConfiguration.dots[
                  trialConfiguration.colorSelectionDotIndex
                ];
              game.addTrialData(
                "color_selected_correct",
                Equal.rgbaColor(colorTargetDot.rgbaColor, selectedRgba),
              );
              game.presentScene(locationSelectionScene);
            },
          }),
        ]),
      );
    });

    colorSelectionScene.addChild(colorSelectionDoneButton);

    colorSelectionScene.onSetup(() => {
      whatColorLabel.hidden = false;
      colorPaletteOutline.hidden = false;
      colorPaletteGrid.hidden = false;
      colorSelectionSceneSquare.removeAllChildren();

      const trialConfiguration = trialConfigurations[game.trialIndex];
      const colorSelectionDotIndex = trialConfiguration.colorSelectionDotIndex;

      const colorSelectionDot =
        screenDots[colorSelectionDotIndex].shape.duplicate();
      colorSelectionDot.fillColor = WebColors.Transparent;
      colorSelectionDot.strokeColor = WebColors.Black;
      colorSelectionDot.lineWidth = 2;

      colorSelectionSceneSquare.addChild(colorSelectionDot);

      colorPaletteGrid.removeAllGridChildren();
      for (let i = 0; i < numberOfColors; i++) {
        const colorDot = new Shape({
          circleOfRadius: dotDiameter / 2,
          fillColor: dotColors[i].rgbaColor,
          isUserInteractionEnabled: true,
        });
        colorDot.size = { width: dotDiameter, height: dotDiameter };

        colorDot.onTapDown(() => {
          colorSelectionDot.fillColor = colorDot.fillColor;
          colorSelectionDoneButton.hidden = false;
          colorSelectionDoneButton.isUserInteractionEnabled = true;
          selectedRgba = colorDot.fillColor;
        });

        colorPaletteGrid.addAtCell(colorDot, 0, i);
      }
    });

    colorSelectionScene.onAppear(() => {
      Timer.startNew("colorRt");
    });

    // ==============================================================
    // SCENE: locationSelection

    const locationSelectionScene = new Scene({
      isUserInteractionEnabled: true,
    });
    game.addScene(locationSelectionScene);

    const locationSelectionSquare = new Shape({
      rect: { size: { width: SQUARE_SIDE_LENGTH, height: SQUARE_SIDE_LENGTH } },
      fillColor: WebColors.Transparent,
      strokeColor: WebColors.Gray,
      lineWidth: 4,
      position: { x: 200, y: 300 },
    });
    locationSelectionScene.addChild(locationSelectionSquare);

    locationSelectionSquare.onPointerDown(() => {
      currentInteractionIsDrag = false;
    });

    const whereDotText = new Label({
      text: "WHERE_WAS",
      fontSize: 24,
      position: { x: 165, y: 75 },
      preferredMaxLayoutWidth: 285,
      horizontalAlignmentMode: LabelHorizontalAlignmentMode.Left,
    });
    locationSelectionScene.addChild(whereDotText);

    const touchToMoveLabel = new Label({
      text: "TOUCH_TO_MOVE",
      fontSize: 24,
      position: { x: 200, y: 530 },
    });
    locationSelectionScene.addChild(touchToMoveLabel);

    let locationSelectionDot: Shape;
    let location_target: {
      x: number;
      y: number;
      color_name: string;
      color_rgba: RgbaColor;
    };

    /**
     * Determines if dot is fully within bounds of the square, and not
     * touching the edge of the square.
     *
     * @returns true if fully within bounds, false otherwise.
     */
    function dotPositionIsFullyWithinSquare(dotPosition: Point) {
      const dotLocation = calculatePositionWithinSquare(dotPosition);
      if (
        dotLocation.x < dotDiameter / 2 ||
        dotLocation.x + dotDiameter / 2 > SQUARE_SIDE_LENGTH ||
        dotLocation.y < dotDiameter / 2 ||
        dotLocation.y + dotDiameter / 2 > SQUARE_SIDE_LENGTH
      ) {
        return false;
      } else {
        return true;
      }
    }

    /**
     * Determines if dot center is within bounds of the square.
     *
     * @returns true if dot center is within bounds, false otherwise.
     */
    function dotPositionIsWithinSquare(dotPosition: Point) {
      const dotLocation = calculatePositionWithinSquare(dotPosition);
      if (
        dotLocation.x < 0 ||
        dotLocation.x > SQUARE_SIDE_LENGTH ||
        dotLocation.y < 0 ||
        dotLocation.y > SQUARE_SIDE_LENGTH
      ) {
        return false;
      } else {
        return true;
      }
    }

    /**
     * Calculates a position relative to the square's coordinate system.
     *
     * @remarks This function is needed because the dot's position is
     * relative to the scene's coordinate system.
     *
     * @returns location Point
     */
    function calculatePositionWithinSquare(position: Point): Point {
      // upper left corner of square on the scene's coordinate system
      const squareOrigin =
        locationSelectionSquare.position.x - SQUARE_SIDE_LENGTH / 2;
      const squareOriginY =
        locationSelectionSquare.position.y - SQUARE_SIDE_LENGTH / 2;
      const x = position.x - squareOrigin;
      const y = position.y - squareOriginY;
      return { x, y };
    }

    let currentInteractionIsDrag = false;

    locationSelectionScene.onPointerUp((pointerEvent) => {
      if (currentInteractionIsDrag) {
        return;
      }
      if (!dotPositionIsWithinSquare(pointerEvent.point)) {
        return;
      }

      locationSelectionDot.position = {
        x: pointerEvent.point.x,
        y: pointerEvent.point.y,
      };
      if (dotPositionIsFullyWithinSquare(locationSelectionDot.position)) {
        locationSelectionDoneButton.hidden = false;
      } else {
        locationSelectionDoneButton.hidden = true;
      }
    });

    locationSelectionScene.onSetup(() => {
      const trialConfiguration = trialConfigurations[game.trialIndex];
      const colorSelectionDotIndex = trialConfiguration.colorSelectionDotIndex;

      locationSelectionDoneButton.hidden = true;
      locationSelectionSquare.removeAllChildren();

      const priorColorSelectedDot = new Shape({
        circleOfRadius: dotDiameter / 2,
        fillColor: selectedRgba,
        strokeColor: WebColors.Black,
        lineWidth: 2,
        position: {
          x:
            trialConfiguration.dots[colorSelectionDotIndex].x -
            SQUARE_SIDE_LENGTH / 2,
          y:
            trialConfiguration.dots[colorSelectionDotIndex].y -
            SQUARE_SIDE_LENGTH / 2,
        },
      });
      locationSelectionSquare.addChild(priorColorSelectedDot);

      let locationSelectionDotIndex = -1;
      do {
        locationSelectionDotIndex = RandomDraws.singleFromRange(
          0,
          numberOfDots - 1,
        );
        if (
          Equal.rgbaColor(
            trialConfiguration.dots[locationSelectionDotIndex].rgbaColor,
            selectedRgba,
          )
        ) {
          locationSelectionDotIndex = -1;
        }
        if (locationSelectionDotIndex === colorSelectionDotIndex) {
          locationSelectionDotIndex = -1;
        }
      } while (locationSelectionDotIndex === -1);

      trialConfiguration.locationSelectionDotIndex = locationSelectionDotIndex;

      locationSelectionDot = new Shape({
        circleOfRadius: dotDiameter / 2,
        fillColor: trialConfiguration.dots[locationSelectionDotIndex].rgbaColor,
        position: { x: 345, y: 75 },
        isUserInteractionEnabled: true,
        draggable: true,
      });
      locationSelectionScene.addChild(locationSelectionDot);

      location_target = {
        x: trialConfiguration.dots[locationSelectionDotIndex].x,
        y: trialConfiguration.dots[locationSelectionDotIndex].y,
        color_name:
          trialConfiguration.dots[locationSelectionDotIndex].colorName,
        color_rgba:
          trialConfiguration.dots[locationSelectionDotIndex].rgbaColor,
      };

      const presentedDots = [];
      for (let i = 0; i < trialConfiguration.dots.length; i++) {
        const dot = {
          color_name: trialConfiguration.dots[i].colorName,
          rgba_color: trialConfiguration.dots[i].rgbaColor,
          location: {
            x: trialConfiguration.dots[i].x,
            y: trialConfiguration.dots[i].y,
          },
        };
        presentedDots.push(dot);
      }
      game.addTrialData("presented_dots", presentedDots);
      game.addTrialData(
        "color_target_dot_index",
        trialConfiguration.colorSelectionDotIndex,
      );
      game.addTrialData(
        "location_target_dot_index",
        trialConfiguration.locationSelectionDotIndex,
      );

      if (!selectedRgba) {
        throw new M2Error("no selected color!");
      }
      priorColorSelectedDot.fillColor = selectedRgba;

      locationSelectionDot.onTapDown((tapEvent) => {
        /** Prevent other nodes from receiving the tap event.
         * Specifically, this prevents the quit button from being pressed if
         * the user taps on the dot. Note: the dot placement on the
         * square listens for PointerDown, so that will not be affected. */
        tapEvent.handled = true;
      });

      locationSelectionDot.onDragStart(() => {
        currentInteractionIsDrag = true;
      });

      locationSelectionDot.onDrag(() => {
        if (dotPositionIsFullyWithinSquare(locationSelectionDot.position)) {
          locationSelectionDoneButton.hidden = false;
        } else {
          locationSelectionDoneButton.hidden = true;
        }
      });

      locationSelectionDot.onDragEnd(() => {
        currentInteractionIsDrag = false;

        if (dotPositionIsFullyWithinSquare(locationSelectionDot.position)) {
          locationSelectionDoneButton.hidden = false;
        } else {
          locationSelectionDoneButton.hidden = true;
        }
      });
    });

    locationSelectionScene.onAppear(() => {
      Timer.startNew("locationRt");
    });

    let locationRt = -1;

    const locationSelectionDoneButton = new Button({
      position: { x: 200, y: 650 },
      text: "DONE_BUTTON_TEXT",
      hidden: true,
      isUserInteractionEnabled: true,
    });
    locationSelectionDoneButton.onTapDown(() => {
      Timer.stop("locationRt");
      locationRt = Timer.elapsed("locationRt");
      Timer.remove("locationRt");
      game.addTrialData("location_selection_response_time_ms", locationRt);
      game.addTrialData(
        "trial_end_iso8601_timestamp",
        new Date().toISOString(),
      );
      locationSelectionScene.removeChild(locationSelectionDot);

      const location_selected = calculatePositionWithinSquare(
        locationSelectionDot.position,
      );
      game.addTrialData("location_selected", location_selected);
      game.addTrialData("square_side_length", SQUARE_SIDE_LENGTH);
      const delta = Math.sqrt(
        Math.pow(location_selected.x - location_target.x, 2) +
          Math.pow(location_selected.y - location_target.y, 2),
      );
      game.addTrialData("location_selected_delta", delta);
      game.addTrialData("quit_button_pressed", false);
      game.addTrialData("trial_index", game.trialIndex);
      game.trialComplete();
      if (game.trialIndex < game.getParameter<number>("number_of_trials")) {
        game.presentScene(fixationScene);
      } else {
        if (game.getParameter<boolean>("scoring")) {
          const scores = game.calculateScores(game.data.trials, {
            rtLowerBound: game.getParameter<Array<number>>(
              "scoring_filter_response_time_duration_ms",
            )[0],
            rtUpperBound: game.getParameter<Array<number>>(
              "scoring_filter_response_time_duration_ms",
            )[1],
            numberOfTrials: game.getParameter<number>("number_of_trials"),
            dotDiameter: game.getParameter<number>("dot_diameter"),
          });
          game.addScoringData(scores);
          game.scoringComplete();
        }

        if (game.getParameter("show_trials_complete_scene")) {
          game.presentScene(
            doneScene,
            Transition.slide({
              direction: TransitionDirection.Left,
              duration: 500,
              easing: Easings.sinusoidalInOut,
            }),
          );
        } else {
          game.end();
        }
      }
    });
    locationSelectionScene.addChild(locationSelectionDoneButton);

    // ==============================================================
    // SCENE: done. Show done message, with a button to exit.
    const doneScene = new Scene();
    game.addScene(doneScene);

    const doneSceneText = new Label({
      text: "TRIALS_COMPLETE_SCENE_TEXT",
      position: { x: 200, y: 400 },
    });
    doneScene.addChild(doneSceneText);

    const okButton = new Button({
      text: "TRIALS_COMPLETE_SCENE_BUTTON_TEXT",
      position: { x: 200, y: 650 },
    });
    okButton.isUserInteractionEnabled = true;
    okButton.onTapDown(() => {
      // don't allow repeat taps of ok button
      okButton.isUserInteractionEnabled = false;
      doneScene.removeAllChildren();
      game.end();
    });
    doneScene.addChild(okButton);
    doneScene.onSetup(() => {
      // no need to have cancel button, because we're done
      game.removeAllFreeNodes();
    });
  }

  calculateScores(
    data: ActivityKeyValueData[],
    extras: {
      rtLowerBound: number;
      rtUpperBound: number;
      numberOfTrials: number;
      dotDiameter: number;
    },
  ) {
    /**
     * Calculate the maximum distance from a point within a square.
     *
     * @remarks When calculating the participant score, we need to know the
     * maximum possible distance from the target location to any possible
     * location within the square (the "worst" possible response). This is
     * needed to scale the placement response between 0 and 100.
     * We also account for a buffer distance from the edges of the
     * square  because the dot cannot be placed such that it is outside the
     * square. The buffer is equal to the dot radius.
     *
     * @param s - side length of the square.
     * @param p - point within the square.
     * @param buffer - buffer distance from the edges of the square.
     * @returns The maximum distance from the point to the corners of the
     * square, less the buffer.
     */
    const maxDistanceWithinSquare = (
      s: number,
      p: { x: number; y: number },
      buffer: number,
    ): number => {
      const corners: Point[] = [
        { x: buffer, y: buffer },
        { x: s - buffer, y: buffer },
        { x: buffer, y: s - buffer },
        { x: s - buffer, y: s - buffer },
      ];

      return corners.reduce((maxDist, corner) => {
        const dx = p.x - corner.x;
        const dy = p.y - corner.y;
        const dist = Math.sqrt(dx * dx + dy * dy);
        return Math.max(maxDist, dist);
      }, 0);
    };

    const dc = new DataCalc(data);

    // Trials participant completed; remove quit trials from the count.
    const n_trials = dc.filter((o) => o.quit_button_pressed === false).length;

    const scores = dc
      .filter((o) => o.quit_button_pressed === false)
      .mutate({
        trial_score: (obs) => {
          const maxDistance = maxDistanceWithinSquare(
            obs.square_side_length,
            obs.presented_dots[obs.location_target_dot_index].location,
            extras.dotDiameter / 2,
          );

          return (
            (((obs.color_selected_correct ? 0.5 : 0) +
              ((maxDistance - obs.location_selected_delta) / maxDistance) *
                0.5) /
              extras.numberOfTrials) *
            100
          );
        },
        metric_accuracy_color: (obs) => {
          if (
            obs.color_selected.color_name ===
            obs.presented_dots[obs.color_target_dot_index].color_name
          ) {
            return "Correct";
          } else if (
            obs.presented_dots
              .map((dot: any) => dot.color_name)
              .includes(obs.color_selected.color_name)
          ) {
            return "Swap";
          }
          return "Random";
        },
        metric_accuracy_location: (obs) => {
          if (obs.location_selected_delta <= 75) {
            return "Correct";
          } else if (
            obs.presented_dots
              .map((dot: any) =>
                euclideanDistance(dot.location, obs.location_selected),
              )
              .some((dist: number) => dist <= 75)
          ) {
            return "Swap";
          }
          return "Random";
        },
        color_section_rt_filtered: (obs) =>
          obs.color_selection_response_time_ms >= extras.rtLowerBound &&
          obs.color_selection_response_time_ms <= extras.rtUpperBound,
        location_section_rt_filtered: (obs) =>
          obs.location_selection_response_time_ms >= extras.rtLowerBound &&
          obs.location_selection_response_time_ms <= extras.rtUpperBound,
      })
      .summarize({
        activity_begin_iso8601_timestamp: this.beginIso8601Timestamp,
        first_trial_begin_iso8601_timestamp: arrange(
          "trial_begin_iso8601_timestamp",
        )
          .slice(0)
          .pull("trial_begin_iso8601_timestamp"),
        last_trial_end_iso8601_timestamp: arrange(
          "-trial_end_iso8601_timestamp",
        )
          .slice(0)
          .pull("trial_end_iso8601_timestamp"),
        n_trials: n_trials,
        flag_trials_match_expected: n_trials === extras.numberOfTrials ? 1 : 0,
        flag_trials_lt_expected: n_trials < extras.numberOfTrials ? 1 : 0,
        flag_trials_gt_expected: n_trials > extras.numberOfTrials ? 1 : 0,
        // Swaps Only
        n_trials_color_swap: filter((o) => o.metric_accuracy_color === "Swap")
          .length,
        n_trials_location_swap: filter(
          (o) => o.metric_accuracy_location === "Swap",
        ).length,
        n_responses_swap_total: scalar(
          filter((o) => o.metric_accuracy_color === "Swap").length,
        ).add(
          scalar(filter((o) => o.metric_accuracy_location === "Swap").length),
        ),
        // All Incorrect (Swaps + Random)
        n_trials_color_incorrect: filter(
          (o) => o.metric_accuracy_color !== "Correct",
        ).length,
        n_trials_location_incorrect: filter(
          (o) => o.metric_accuracy_location !== "Correct",
        ).length,
        n_responses_incorrect_total: scalar(
          filter((o) => o.metric_accuracy_color !== "Correct").length,
        ).add(
          scalar(
            filter((o) => o.metric_accuracy_location !== "Correct").length,
          ),
        ),
        // Correct
        n_trials_color_correct: filter(
          (o) => o.metric_accuracy_color === "Correct",
        ).length,
        n_trials_location_correct: filter(
          (o) => o.metric_accuracy_location === "Correct",
        ).length,
        n_responses_correct_total: scalar(
          filter((o) => o.metric_accuracy_color === "Correct").length,
        ).add(
          scalar(
            filter((o) => o.metric_accuracy_location === "Correct").length,
          ),
        ),
        // Filter out outliers: RT < 100 ms or RT > 10,000 ms
        median_response_time_color_filtered: median(
          filter((o) => o.color_section_rt_filtered).pull(
            "color_selection_response_time_ms",
          ),
        ),
        median_response_time_location_filtered: median(
          filter((o) => o.location_section_rt_filtered).pull(
            "location_selection_response_time_ms",
          ),
        ),
        // RT for Correct AND RT within bounds
        median_response_time_color_filtered_correct: median(
          filter(
            (o) =>
              o.color_section_rt_filtered &&
              o.metric_accuracy_color === "Correct",
          ).pull("color_selection_response_time_ms"),
        ),
        median_response_time_location_filtered_correct: median(
          filter(
            (o) =>
              o.location_section_rt_filtered &&
              o.metric_accuracy_location === "Correct",
          ).pull("location_selection_response_time_ms"),
        ),
        // RT for Swaps AND RT within bounds
        median_response_time_color_filtered_swap: median(
          filter(
            (o) =>
              o.color_section_rt_filtered && o.metric_accuracy_color === "Swap",
          ).pull("color_selection_response_time_ms"),
        ),
        median_response_time_location_filtered_swap: median(
          filter(
            (o) =>
              o.location_section_rt_filtered &&
              o.metric_accuracy_location === "Swap",
          ).pull("location_selection_response_time_ms"),
        ),
        // RT for Incorrect (swap & random) AND RT within bounds
        median_response_time_color_filtered_incorrect: median(
          filter(
            (o) =>
              o.color_section_rt_filtered &&
              o.metric_accuracy_color !== "Correct",
          ).pull("color_selection_response_time_ms"),
        ),
        median_response_time_location_filtered_incorrect: median(
          filter(
            (o) =>
              o.location_section_rt_filtered &&
              o.metric_accuracy_location !== "Correct",
          ).pull("location_selection_response_time_ms"),
        ),
        participant_score: sum("trial_score"),
      });
    return scores.observations;
  }
}

interface Dot {
  x: number;
  y: number;
}

function euclideanDistance(dot1: Dot, dot2: Dot): number {
  const xDiff = dot1.x - dot2.x;
  const yDiff = dot1.y - dot2.y;
  return Math.sqrt(xDiff * xDiff + yDiff * yDiff);
}

export { ColorDots };
