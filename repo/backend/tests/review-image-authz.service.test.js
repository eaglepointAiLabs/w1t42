const fs = require("fs");
const { pool } = require("../src/db/pool");
const { getReviewImage } = require("../src/modules/reviews/reviews.image.service");

describe("Review image object authorization", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    vi.spyOn(fs, "existsSync").mockReturnValue(true);
    pool.query = vi.fn();
  });

  test("owner can access image", async () => {
    pool.query.mockResolvedValueOnce([[{
      id: 81,
      file_path: "/tmp/review-81.jpg",
      mime_type: "image/jpeg",
      review_state: "published",
      review_user_id: 100
    }]]);

    const image = await getReviewImage({ imageId: 81, requester: { id: 100, roles: ["user"] } });
    expect(image.id).toBe(81);
  });

  test("non-owner is denied", async () => {
    pool.query.mockResolvedValueOnce([[{
      id: 82,
      file_path: "/tmp/review-82.jpg",
      mime_type: "image/jpeg",
      review_state: "published",
      review_user_id: 100
    }]]);

    await expect(getReviewImage({ imageId: 82, requester: { id: 200, roles: ["user"] } })).rejects.toMatchObject({
      status: 403,
      code: "FORBIDDEN"
    });
  });

  test("privileged role can access non-owned image", async () => {
    pool.query.mockResolvedValueOnce([[{
      id: 83,
      file_path: "/tmp/review-83.jpg",
      mime_type: "image/jpeg",
      review_state: "published",
      review_user_id: 100
    }]]);

    const image = await getReviewImage({ imageId: 83, requester: { id: 200, roles: ["support"] } });
    expect(image.id).toBe(83);
  });

  test("returns not-found for missing resource and forbidden for unauthorized existing image", async () => {
    pool.query.mockResolvedValueOnce([[]]);
    await expect(getReviewImage({ imageId: 999, requester: { id: 1, roles: ["user"] } })).rejects.toMatchObject({
      status: 404,
      code: "IMAGE_NOT_FOUND"
    });

    pool.query.mockResolvedValueOnce([[{
      id: 84,
      file_path: "/tmp/review-84.jpg",
      mime_type: "image/jpeg",
      review_state: "published",
      review_user_id: 300
    }]]);

    await expect(getReviewImage({ imageId: 84, requester: { id: 301, roles: ["user"] } })).rejects.toMatchObject({
      status: 403,
      code: "FORBIDDEN"
    });
  });
});
