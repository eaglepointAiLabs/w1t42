const { z } = require("zod");

const analyticsFiltersSchema = z.object({
  fromDate: z.string().optional(),
  toDate: z.string().optional(),
  courseServiceId: z.coerce.number().int().positive().optional(),
  kind: z.enum(["course", "service"]).optional(),
  channel: z.string().max(80).optional(),
  instructorUserId: z.coerce.number().int().positive().optional(),
  locationCode: z.string().max(80).optional()
});

const reportTypeSchema = z.object({
  report: z.enum([
    "enrollment_funnel",
    "course_popularity",
    "renewal_rates",
    "refund_rates",
    "channel_performance",
    "instructor_utilization",
    "location_revenue_cost"
  ])
});

const exportPayloadSchema = z.object({
  report: reportTypeSchema.shape.report,
  filters: analyticsFiltersSchema.default({})
});

module.exports = {
  analyticsFiltersSchema,
  reportTypeSchema,
  exportPayloadSchema
};
