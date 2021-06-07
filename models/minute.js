const mongoose = require("mongoose");

const minuteSchema = mongoose.Schema({
	symbol: {type: String, required: true, maxlength: 6, minlength: 2},
	prices: {type: Array, required: false, default: []}
});

module.exports = mongoose.model("Minute", minuteSchema);
