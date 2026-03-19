import { registerPlugin } from "@capacitor/core";
const M2c2Plugin = registerPlugin("M2c2Plugin");
export function sendToNative(event) {
  return M2c2Plugin.postEvent(event);
}
export function onNativeEvent(cb) {
  window.addEventListener("nativeEvent", (e) => cb(e.detail));
}
