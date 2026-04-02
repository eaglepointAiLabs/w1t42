const Router = require("@koa/router");
const healthRoutes = require("./health");
const authRoutes = require("../modules/auth/auth.routes");
const adminRoutes = require("../modules/admin/admin.routes");
const usersRoutes = require("../modules/users/users.routes");
const ordersRoutes = require("../modules/orders/orders.routes");
const paymentsRoutes = require("../modules/payments/payments.routes");
const reviewsRoutes = require("../modules/reviews/reviews.routes");
const staffReviewRoutes = require("../modules/reviews/staff.routes");
const adminGovernanceRoutes = require("../modules/reviews/admin-governance.routes");
const placesRoutes = require("../modules/activities/places.routes");
const activitiesRoutes = require("../modules/activities/activities.routes");
const followsRoutes = require("../modules/follows/follows.routes");
const feedRoutes = require("../modules/feed/feed.routes");
const ingestionRoutes = require("../modules/ingestion/ingestion.routes");
const catalogRoutes = require("../modules/catalog/catalog.routes");
const analyticsRoutes = require("../modules/analytics/analytics.routes");
const { successResponse } = require("../utils/api-response");

const router = new Router();

router.use(healthRoutes.routes(), healthRoutes.allowedMethods());
router.use(authRoutes.routes(), authRoutes.allowedMethods());
router.use(adminRoutes.routes(), adminRoutes.allowedMethods());
router.use(usersRoutes.routes(), usersRoutes.allowedMethods());
router.use(ordersRoutes.routes(), ordersRoutes.allowedMethods());
router.use(paymentsRoutes.routes(), paymentsRoutes.allowedMethods());
router.use(reviewsRoutes.routes(), reviewsRoutes.allowedMethods());
router.use(staffReviewRoutes.routes(), staffReviewRoutes.allowedMethods());
router.use(adminGovernanceRoutes.routes(), adminGovernanceRoutes.allowedMethods());
router.use(placesRoutes.routes(), placesRoutes.allowedMethods());
router.use(activitiesRoutes.routes(), activitiesRoutes.allowedMethods());
router.use(followsRoutes.routes(), followsRoutes.allowedMethods());
router.use(feedRoutes.routes(), feedRoutes.allowedMethods());
router.use(ingestionRoutes.routes(), ingestionRoutes.allowedMethods());
router.use(catalogRoutes.routes(), catalogRoutes.allowedMethods());
router.use(analyticsRoutes.routes(), analyticsRoutes.allowedMethods());

router.get("/api", (ctx) => {
  ctx.body = successResponse({
    message: "TrailForge API foundation is online"
  });
});

module.exports = router;
