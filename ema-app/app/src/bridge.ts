import { registerPlugin } from "@capacitor/core";
import type {
  NativeToJSEvent,
  JSToNativeEvent,
} from "../../contracts/bridge-events";

const M2c2Plugin = registerPlugin<{
  postEvent(data: JSToNativeEvent): Promise<void>;
}>("M2c2Plugin");

export function sendToNative(event: JSToNativeEvent): Promise<void> {
  return M2c2Plugin.postEvent(event);
}

export function onNativeEvent(cb: (event: NativeToJSEvent) => void): void {
  (
    window as unknown as {
      addEventListener: (
        type: string,
        handler: (e: CustomEvent<NativeToJSEvent>) => void,
      ) => void;
    }
  ).addEventListener("nativeEvent", (e) => cb(e.detail));
}

/** Dispatch a NativeToJSEvent locally (used by scheduler on notification tap). */
export function dispatchLocalNativeEvent(event: NativeToJSEvent): void {
  window.dispatchEvent(new CustomEvent("nativeEvent", { detail: event }));
}
