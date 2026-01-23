import type { GlobalVariables } from "..";

declare global {
  // Must be var to be in the global scope
  var m2c2Globals: GlobalVariables;
}

export {};
