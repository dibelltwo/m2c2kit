/**
 * When running on iOS, webkit is available on window.
 * The message handler "iOSM2c2" and function IOSM2c2.sessionManualStart() is defined
 * by the iOS app. Message handler could have been called anything, but the
 * iOS app defined it as "iOSM2c2".
 */
declare global {
  interface Window {
    webkit: {
      messageHandlers: {
        iOSM2c2: {
          postMessage: (event: SessionEvent | ActivityEvent) => void;
        };
      };
    };
    /**
     * The following two message handlers are used to communicate with the
     * MetricWire Catalyst app. These definitions must match what the Catalyst
     * app expects, which is not part of the m2c2kit codebase and not in our
     * control.
     */
    /**
     * Used in both web view and cognitive task
     */
    catalystMessageHandler: {
      postMessage: (message: string) => void;
    };
    /**
     * Used only in cognitive task
     */
    cognitiveTaskMessageHandler: {
      postMessage: (message: string) => void;
    };
  }
}

export {};
