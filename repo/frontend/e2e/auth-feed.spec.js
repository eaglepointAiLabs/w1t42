import { test, expect } from "@playwright/test";

test("guest is guarded and authenticated user can perform feed action", async ({ page }) => {
  let authenticated = false;

  await page.route("**/api/v1/**", async (route) => {
    const url = route.request().url();
    const method = route.request().method();

    if (url.endsWith("/api/v1/auth/me") && method === "GET") {
      if (!authenticated) {
        await route.fulfill({
          status: 401,
          contentType: "application/json",
          body: JSON.stringify({ success: false, error: { code: "UNAUTHORIZED", message: "Authentication required" } })
        });
        return;
      }

      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          success: true,
          data: { id: 42, username: "athlete1", roles: ["user"], status: "active" }
        })
      });
      return;
    }

    if (url.endsWith("/api/v1/auth/login") && method === "POST") {
      authenticated = true;
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ success: true, data: { login: true } })
      });
      return;
    }

    if (url.includes("/api/v1/feed/preferences") && method === "GET") {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ success: true, data: { preferredSports: ["running"] } })
      });
      return;
    }

    if (url.includes("/api/v1/feed?limit=") && method === "GET") {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          success: true,
          data: [
            {
              id: 1,
              type: "news",
              title: "Morning Run Tips",
              author: "Coach Jane",
              authorUserId: 99,
              summary: "Stay hydrated and warm up first.",
              tags: ["running"],
              score: 0.9,
              similarityKey: "news:1"
            }
          ]
        })
      });
      return;
    }

    if (url.endsWith("/api/v1/follows/mine") && method === "GET") {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ success: true, data: [] })
      });
      return;
    }

    if (url.endsWith("/api/v1/feed/actions") && method === "POST") {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ success: true, data: { recorded: true } })
      });
      return;
    }

    await route.fulfill({
      status: 404,
      contentType: "application/json",
      body: JSON.stringify({ success: false, error: { code: "NOT_FOUND", message: "Unhandled test route" } })
    });
  });

  await page.goto("/orders");
  await expect(page).toHaveURL(/\/login$/);

  await page.getByLabel("Username").fill("athlete1");
  await page.getByLabel("Password").fill("athlete12345");
  await page.getByRole("button", { name: "Sign In" }).click();

  await expect(page).toHaveURL("/");
  await expect(page.getByRole("heading", { name: "Personalized Home Feed" })).toBeVisible();
  await expect(page.getByText("Morning Run Tips")).toBeVisible();

  await page.getByRole("button", { name: "Not Interested" }).click();
  await expect(page.getByText("Morning Run Tips")).toHaveCount(0);
});
