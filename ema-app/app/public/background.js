// Background Runner script for EMA prompt scheduling.
// Runs in a background context (no DOM, no window, no IndexedDB).
// Fires on the "checkSchedule" event every 15 minutes.
// Uses CapacitorKV (BackgroundRunner.getData/setData) for lightweight storage.

addEventListener("checkSchedule", async (resolve, reject, _args) => {
  try {
    const now = Date.now();

    // Read pending prompts stored by the Scheduler (JS layer on last foreground)
    const pendingRaw = await BackgroundRunner.getData({
      key: "pending_prompts",
    });
    const expiryMsRaw = await BackgroundRunner.getData({ key: "expiry_ms" });

    const prompts = pendingRaw ? JSON.parse(pendingRaw) : [];
    const expiryMs = expiryMsRaw ? Number(expiryMsRaw) : 30 * 60 * 1000; // default 30 min

    let changed = false;

    for (const p of prompts) {
      if (p.status === "sent" && p.sent_at) {
        // Delivered but not opened — check if past expiry
        if (now - p.sent_at > expiryMs) {
          p.status = "expired";
          changed = true;
        }
      } else if (p.status === "scheduled") {
        // Notification was due but never delivered (device was offline)
        if (now > p.scheduled_for + expiryMs) {
          p.status = "missed";
          changed = true;
        }
      }
    }

    if (changed) {
      await BackgroundRunner.setData({
        key: "pending_prompts",
        value: JSON.stringify(prompts),
      });
    }

    resolve();
  } catch (err) {
    reject(err);
  }
});
