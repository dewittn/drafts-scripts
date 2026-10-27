require("shared/libraries/bear.js");

// Review Spark Notes. Opens this year's spark notes tag in Bear.
const year = new Date().getFullYear();
Bear.create().openTag(`Reference/Ideas/Spark Notes/${year}`);
