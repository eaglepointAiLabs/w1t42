const request = require("supertest");
const app = require("../src/app");

describe("Error response format", () => {
  test("returns structured JSON for unknown routes", async () => {
    const response = await request(app.callback()).get("/api/v1/does-not-exist");

    expect(response.status).toBe(404);
    expect(response.body.success).toBe(false);
    expect(response.body.error.code).toBe("NOT_FOUND");
    expect(typeof response.body.error.message).toBe("string");
    expect(response.body.error).toHaveProperty("requestId");
  });

  test("returns structured JSON for validation errors", async () => {
    const response = await request(app.callback()).post("/api/v1/auth/register").send({ username: "x" });

    expect(response.status).toBe(400);
    expect(response.body.success).toBe(false);
    expect(response.body.error.code).toBe("VALIDATION_ERROR");
    expect(response.body.error.details).not.toBeNull();
  });
});
