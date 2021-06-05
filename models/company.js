const mongoose = require("mongoose");

const companySchema = mongoose.Schema({
	cid: {type: String, required: true, maxlength: 36, minlength: 36},
	name: {type: String, required: true, maxlength: 36, minlength: 5},
	ticker: {type: String, required: true, maxlength: 6, minlength: 2},
	owner: {type: String, required: true, maxlength: 36, minlength: 36},
	price: {type: Number, required: false, default: 1},
	shares: {type: Number, required: false, default: 100000}
});

module.exports = mongoose.model("Companie", companySchema);
