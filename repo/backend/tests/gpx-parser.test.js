const { parseGpxCoordinates, validateGpxUploadMeta } = require("../src/modules/activities/gpx.parser");

describe("GPX parser", () => {
  test("parses coordinates from gpx", () => {
    const gpx = `
      <gpx version="1.1">
        <trk><trkseg>
          <trkpt lat="40.1234567" lon="-74.1234567"><ele>10.5</ele><time>2026-03-29T10:00:00Z</time></trkpt>
          <trkpt lat="40.2234567" lon="-74.2234567"><ele>11.5</ele><time>2026-03-29T10:00:05Z</time></trkpt>
        </trkseg></trk>
      </gpx>
    `;

    const points = parseGpxCoordinates(gpx);
    expect(points).toHaveLength(2);
    expect(points[0].latitude).toBe(40.1234567);
    expect(points[0].longitude).toBe(-74.1234567);
  });

  test("rejects invalid gpx metadata", () => {
    expect(() =>
      validateGpxUploadMeta({ fileName: "bad.txt", mimeType: "text/plain", sizeBytes: 10 })
    ).toThrow(/\.gpx/);
  });

  test("rejects when no points found", () => {
    expect(() => parseGpxCoordinates("<gpx><trk></trk></gpx>")).toThrow(/No coordinate points/);
  });
});
