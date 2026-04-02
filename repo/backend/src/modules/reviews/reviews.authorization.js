const ApiError = require("../../errors/api-error");

const PRIVILEGED_REVIEW_ROLES = new Set(["admin", "support", "coach"]);

function hasPrivilegedReviewAccess(roles = []) {
  return roles.some((role) => PRIVILEGED_REVIEW_ROLES.has(role));
}

function ensureCanAccessReviewImage({ image, requester }) {
  const isOwner = requester && Number(requester.id) === Number(image.review_user_id);
  const isPrivileged = requester && hasPrivilegedReviewAccess(requester.roles || []);

  if (isOwner || isPrivileged) {
    return;
  }

  throw new ApiError(403, "FORBIDDEN", "Cannot access this review image");
}

function ensureCanAccessReviewDetail({ review, requester }) {
  const isOwner = requester && Number(requester.id) === Number(review.user_id);
  const isPrivileged = requester && hasPrivilegedReviewAccess(requester.roles || []);

  if (isOwner || isPrivileged) {
    return;
  }

  throw new ApiError(403, "FORBIDDEN", "Cannot access this review");
}

module.exports = {
  hasPrivilegedReviewAccess,
  ensureCanAccessReviewImage,
  ensureCanAccessReviewDetail
};
