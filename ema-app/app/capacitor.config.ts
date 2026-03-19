import { CapacitorConfig } from "@capacitor/cli";

const config: CapacitorConfig = {
  appId: "com.m2c2kit.ema",
  appName: "M2C2 EMA",
  webDir: "dist",
  plugins: {
    BackgroundRunner: {
      label: "ema.background.check",
      src: "background.js",
      event: "checkSchedule",
      repeat: true,
      interval: 15, // minutes — minimum granularity on iOS
      autoStart: true,
    },
    LocalNotifications: {
      smallIcon: "ic_stat_icon_config_sample",
      iconColor: "#488AFF",
    },
  },
};

export default config;
