const express = require("express");
const router = express.Router();
const uuid = require("uuid");
const config = require("../config");


const getAccounts = async (req, res) => {
	await config.Account.find().exec().catch(err => {
		return res.status(500).json({message: `Error: ${err}`, result: {error: err}});
	}).then(result => {
		return res.json({message: "Accounts Retrieved Successfully.", result: result});
	});
};

const getAccount = async (req, res) => {
	let aid = req.params.aid;

	await config.Account.findOne({aid: aid}).exec().catch(err => {
		return res.status(500).json({message: `Error: ${err}`, result: {error: err}});
	}).then(result => {
		if (!result) {
			return res.status(404).json({message: "Could Not Find Account. This Could Be Because It Doesn't Exist Or Was Deleted.", result: {error: "Account Not Found"}});
		}
		return res.json({message: "Account Retrived Successfully.", result: result});
	});
};

const createAccount = async (req, res) => {
	const newAccount = config.Account({
		aid: uuid.v4(),
		name: req.body.name,
		cash: parseFloat(req.body.cash),
	});

	await newAccount.save().catch(err => {
		return res.status(400).json({message: `Error: ${err}`, result: {error: err}});
	}).then(result => {
		return res.json({message: "Account Created Successfully.", result: result});
	});
};

const deleteAccount = async (req, res) => {
	let aid = req.params.aid;

	await config.Account.deleteOne({aid: aid}).exec().catch(err => {
		return res.status(400).json({message: `Error: ${err}`, result: {error: err}});
	}).then(result => {
		return res.json({message: "Account Deleted Successfully.", result: result});
	});
};



router.get("/", getAccounts);
router.get("/:aid", getAccount);
router.post("/create", createAccount);
router.delete("/delete/:aid", deleteAccount);

module.exports = router;
