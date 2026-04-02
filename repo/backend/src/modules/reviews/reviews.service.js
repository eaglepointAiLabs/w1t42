const coreService = require("./reviews.core.service");
const imageService = require("./reviews.image.service");

module.exports = {
  ...coreService,
  ...imageService
};
