function successResponse(data, meta = {}) {
  return {
    success: true,
    data,
    meta
  };
}

function errorResponse({ code, message, details = null, requestId = null }) {
  return {
    success: false,
    error: {
      code,
      message,
      details,
      requestId
    }
  };
}

module.exports = {
  successResponse,
  errorResponse
};
