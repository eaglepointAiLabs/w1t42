const request = require("supertest");
const app = require("../src/app");

describe("Health endpoint", () => {
  it("returns ok status", async () => {
    const response = await request(app.callback()).get("/health");

    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);
    expect(response.body.data.status).toBe("ok");
  });
});
