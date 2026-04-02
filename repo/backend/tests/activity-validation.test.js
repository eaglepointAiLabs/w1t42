const { validateActivityPayload } = require("../src/modules/activities/activity.validation");

describe("Activity validation", () => {
  test("accepts valid payload", () => {
    const result = validateActivityPayload({
      activityType: "running",
      durationSeconds: 1800,
      distanceMiles: 3.25,
      calories: 300,
      avgHeartRate: 145,
      paceSecondsPerMile: 554,
      tags: ["tempo", "morning"],
      notes: "Good run",
      locationText: "River path"
    });

    expect(result.activityType).toBe("running");
    expect(result.tags).toEqual(["tempo", "morning"]);
  });

  test("rejects invalid activity type", () => {
    expect(() =>
      validateActivityPayload({ activityType: "swimming", durationSeconds: 10, distanceMiles: 1 })
    ).toThrow(/activityType/);
  });

  test("rejects too many tags", () => {
    const tags = Array.from({ length: 21 }, (_, i) => `tag-${i}`);
    expect(() =>
      validateActivityPayload({ activityType: "walking", durationSeconds: 10, distanceMiles: 1, tags })
    ).toThrow(/At most 20 tags/);
  });
});
