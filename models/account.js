const mongoose = require("mongoose");

const accountSchema = mongoose.Schema({
	aid: {type: String, required: true, maxlength: 36, minlength: 36},
	name: {type: String, required: true, maxlength: 25, minlength: 6},
	cash: {type: Number, required: false, default: 2000},
	portfolio: {type: Object, required: false, default: {}},
});

module.exports = mongoose.model("Account", accountSchema);
