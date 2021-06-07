const mongoose = require("mongoose");

const orderSchema = mongoose.Schema({
	oid: {type: String, required: true, maxlength: 36, minlength: 36},
	aid: {type: String, required: true, maxlength: 36, minlength: 36},
	side: {type: String, required: true, maxlength: 4, minlength: 3},
	symbol: {type: String, required: true, maxlength: 6, minlength: 2},
	shares: {type: Number, required: true}
});

module.exports = mongoose.model("Order", orderSchema);
