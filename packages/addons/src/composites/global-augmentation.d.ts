import type { GlobalVariables } from "@m2c2kit/core";

declare global {
  // Must be var to be in the global scope
  var m2c2Globals: GlobalVariables;
}

export {};
