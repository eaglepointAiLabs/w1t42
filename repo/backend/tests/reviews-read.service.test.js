const { pool } = require("../src/db/pool");
const { getReviewDetail } = require("../src/modules/reviews/reviews.read.service");

describe("reviews.read.service", () => {
  beforeEach(() => {
    pool.query = vi.fn();
  });

  test("hides sensitive review content while under arbitration", async () => {
    pool.query
      .mockResolvedValueOnce([[{ id: 5, user_id: 1, review_state: "under_arbitration", anonymous_display: 0, review_text: "original", published_at: "2099-01-01", username: "u1", display_name: "User One" }]])
      .mockResolvedValueOnce([[{ dimension_config_id: 1, score: 5, label: "Quality", key_name: "quality" }]])
      .mockResolvedValueOnce([[{ id: 12, mime_type: "image/jpeg", file_size_bytes: 100, sort_order: 1 }]])
      .mockResolvedValueOnce([[{ id: 33, review_id: 5, followup_text: "followup" }]])
      .mockResolvedValueOnce([[{ id: 44, parent_reply_id: null, reply_text: "reply", created_at: "2099-01-01", author_role: "support", username: "staff" }]])
      .mockResolvedValueOnce([[{ id: 99, appeal_status: "submitted", submitted_at: "2099-01-01", resolved_at: null }]])
      .mockResolvedValueOnce([[{ event_type: "appeal_submitted", event_status: "submitted", event_note: "x", created_at: "2099-01-01" }]]);

    const detail = await getReviewDetail({ reviewId: 5, requester: { id: 1 } });

    expect(detail.reviewText).toBe("Content hidden during arbitration");
    expect(detail.images).toEqual([]);
    expect(detail.followup).toBeNull();
    expect(detail.replies).toHaveLength(1);
    expect(detail.appeal.timeline).toHaveLength(1);
  });

  test("returns canAppeal true for owner within appeal window and no active appeal", async () => {
    pool.query
      .mockResolvedValueOnce([[{ id: 7, user_id: 8, review_state: "published", anonymous_display: 1, review_text: "body", published_at: new Date().toISOString(), username: "u8", display_name: null }]])
      .mockResolvedValueOnce([[]])
      .mockResolvedValueOnce([[]])
      .mockResolvedValueOnce([[]])
      .mockResolvedValueOnce([[]])
      .mockResolvedValueOnce([[]]);

    const detail = await getReviewDetail({ reviewId: 7, requester: { id: 8 } });

    expect(detail.displayName).toBe("Anonymous User");
    expect(detail.canAppeal).toBe(true);
    expect(detail.appeal).toBeNull();
  });

  test("allows privileged role to access review detail", async () => {
    pool.query
      .mockResolvedValueOnce([[{ id: 77, user_id: 8, review_state: "published", anonymous_display: 0, review_text: "body", published_at: new Date().toISOString(), username: "u8", display_name: "Owner" }]])
      .mockResolvedValueOnce([[]])
      .mockResolvedValueOnce([[]])
      .mockResolvedValueOnce([[]])
      .mockResolvedValueOnce([[]])
      .mockResolvedValueOnce([[]]);

    const detail = await getReviewDetail({ reviewId: 77, requester: { id: 500, roles: ["support"] } });
    expect(detail.id).toBe(77);
  });

  test("denies non-owner regular user with forbidden", async () => {
    pool.query.mockResolvedValueOnce([[{ id: 78, user_id: 8, review_state: "published", anonymous_display: 0, review_text: "body", published_at: new Date().toISOString(), username: "u8", display_name: "Owner" }]]);

    await expect(getReviewDetail({ reviewId: 78, requester: { id: 9, roles: ["user"] } })).rejects.toMatchObject({
      status: 403,
      code: "FORBIDDEN"
    });
    expect(pool.query).toHaveBeenCalledTimes(1);
  });
});
