const express = require("express");
const router = express.Router();
const uuid = require("uuid");
const config = require("../config");


const getCompanys = async (req, res) => {
	await config.Company.find({}).exec().catch(err => {
		return res.status(500).json({message: `Error: ${err}`, result: {error: err}});
	}).then(result => {
		return res.json({message: "Companys Retrieved Successfully.", result: result});
	});
};

const getCompany = async (req, res) => {
	let cid = req.params.cid;

	await config.Company.findOne({cid: cid}).exec().catch(err => {
		return res.status(500).json({message: `Error: ${err}`, result: {error: err}});
	}).then(result => {
		if (!result) {
			return res.status(404).json({message: "Could Not Find Company. This Could Be Because It Doesn't Exist, It Closed, Or Maybe It Went Bankrupt.", result: {error: "Company Not Found"}});
		}
		return res.json({message: "Company Retrived Successfully.", result: result});
	});
};

const createCompany = async (req, res) => {
	const newCompany = config.Company({
		cid: uuid.v4(),
		name: req.body.name,
		symbol: req.body.symbol,
		owner: req.body.owner
	});
	
	await config.Account.findOne({aid: req.body.owner}).exec().catch(err => {
		return res.status(500).json({message: `Error: ${err}`, result: {error: err}});
	}).then(async (garesult) => {
		if (!garesult) {
			return res.status(404).json({message: "Could Not Find Account. This Could Be Because It Doesn't Exist Or Because It Was Deleted.", result: {error: "Account Not Found"}});
		} else if (garesult.cash < 100000) {
			return res.status(402).json({message: "You Do Not Have Enough Money To Start A Company.", result: {error: "Insufficient Funds"}});
		}
		await config.Account.updateOne({aid: req.body.owner}, {cash: garesult.cash-100000}).exec().catch(err => {
			return res.status(500).json({message: `Error: ${err}`, result: {error: err}});
		}).then(async (uaresult) => {
			await newCompany.save().catch(err => {
				return res.status(400).json({message: `Error: ${err}`, result: {error: err}});
			}).then(async cresult => {
				const newMinute = config.Minute({symbol: newCompany.symbol});
				await newMinute.save().catch(err => {
					console.log(err);
				}).then(r => {});
				return res.json({message: "Company Created Successfully.", result: result});
			});
		});
	});
};

const deleteCompany = async (req, res) => {
	let cid = req.params.cid;

	await config.Company.deleteOne({cid: cid}).exec().catch(err => {
		return res.status(400).json({message: `Error: ${err}`, result: {error: err}});
	}).then(result => {
		return res.json({message: "Company Deleted Successfully.", result: result});
	});
};


router.get("/", getCompanys);
router.get("/:cid", getCompany);
router.post("/create", createCompany);
router.delete("/delete/:cid", deleteCompany);

module.exports = router;

