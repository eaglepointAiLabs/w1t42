const request = require("supertest");
const app = require("../src/app");

describe("Follow graph routes", () => {
  test("requires authentication for follow APIs", async () => {
    const mine = await request(app.callback()).get("/api/v1/follows/mine");
    const follow = await request(app.callback()).post("/api/v1/follows/2");
    const unfollow = await request(app.callback()).delete("/api/v1/follows/2");

    expect(mine.status).toBe(401);
    expect(follow.status).toBe(401);
    expect(unfollow.status).toBe(401);
  });
});
