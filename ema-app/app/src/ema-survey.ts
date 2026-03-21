/**
 * EMA self-report survey — mood, stress, and energy sliders.
 * Each slider uses the nouislider-m2c2 custom widget (0–100 VAS).
 */
export const emaSurveyJson = {
  name: "ema-mood-stress",
  id: "ema-mood-stress",
  showQuestionNumbers: "off",
  pages: [
    {
      name: "welcome",
      elements: [
        {
          type: "expression",
          name: "__welcome",
          title: "How are you feeling right now?",
        },
      ],
    },
    {
      name: "mood",
      elements: [
        {
          type: "nouislider-m2c2",
          name: "mood",
          title: "How is your overall MOOD?",
          rangeMin: 0,
          rangeMax: 100,
          start: 50,
          tooltips: true,
          pipsDensity: -1,
          showOnlyPipsWithPipsText: true,
          pipsText: [
            { value: 0, text: "Very Bad" },
            { value: 100, text: "Very Good" },
          ],
        },
      ],
    },
    {
      name: "stress",
      elements: [
        {
          type: "nouislider-m2c2",
          name: "stress",
          title: "How STRESSED do you feel?",
          rangeMin: 0,
          rangeMax: 100,
          start: 50,
          tooltips: true,
          pipsDensity: -1,
          showOnlyPipsWithPipsText: true,
          pipsText: [
            { value: 0, text: "Not at all" },
            { value: 100, text: "Extremely" },
          ],
        },
      ],
    },
    {
      name: "energy",
      elements: [
        {
          type: "nouislider-m2c2",
          name: "energy",
          title: "How much ENERGY do you have?",
          rangeMin: 0,
          rangeMax: 100,
          start: 50,
          tooltips: true,
          pipsDensity: -1,
          showOnlyPipsWithPipsText: true,
          pipsText: [
            { value: 0, text: "Very Tired" },
            { value: 100, text: "Very Energetic" },
          ],
        },
      ],
    },
  ],
};
