const { createReview } = require("./reviews.create.service");
const { addFollowup } = require("./reviews.followup.service");
const { getReviewDetail, listUserReviews } = require("./reviews.read.service");
const { createAppeal, listAppealsForStaff, updateAppealStatus } = require("./reviews.appeals.service");
const { addReply } = require("./reviews.replies.service");

module.exports = {
  createReview,
  addFollowup,
  listUserReviews,
  listAppealsForStaff,
  getReviewDetail,
  createAppeal,
  addReply,
  updateAppealStatus
};
