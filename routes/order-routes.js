const express = require("express");
const router = express.Router();
const uuid = require("uuid");
const config = require("../config");
const async = require("async");

let open_orders = [];

Array.prototype.sortBy = function(p) {

  return this.slice(0).sort(function(a,b) {

    return (a[p] > b[p]) ? 1 : (a[p] < b[p]) ? -1 : 0;

  });

}

const payFee = async (ask, bid) => {
	await config.Account.findOne({aid: config.MAKER_ID}).exec().catch(err => {
		return;
	}).then(async result => {
		if (!result) {
			return;
		}

		await config.Account.updateOne({aid: config.MAKER_ID}, {cash: result.cash+(ask-bid)}).exec().catch(err => {
			return;
		}).then(r => {
			return;
		});	
	});
}

const executeBuyOrder = async (buy, sells) => {
	const buyer_id = buy["aid"];

	await config.Account.findOne({aid: buyer_id}).exec().catch(err => {
		return console.log(err);
	}).then(async result => {
		if (!result) {
			return console.log(err);
		}

		await config.Company.findOne({ticker: buy["symbol"]}).exec().catch(err => {
			return console.log(err);
		}).then(async company_result => {
			if (!company_result) {
				return console.log(err);
			}

			let new_portfolio = {...result["portfolio"]};


			if (buy["symbol"] in Object.keys(new_portfolio)) {
				new_portfolio[buy["symbol"]] += buy["shares"];
			} else {
				new_portfolio[buy["symbol"]] = buy["shares"];
			}

			let buy_price = company_result["ask"]*buy["shares"];
			console.log("UPDATING ACCOUNT LINE 62, NEW ACCOUNT:");
			console.log({portfolio: new_portfolio, cash: result["cash"]-buy_price})
			await config.Account.updateOne({aid: buyer_id}, {portfolio: new_portfolio, cash: result["cash"]-buy_price}).exec().catch(err => {
				return console.log(err);
			}).then(r => {
				payFee(company_result["ask"], company_result["bid"]);
				open_orders = open_orders.filter(o => o.oid != buy["oid"]);
			});
		});
	});


	for (sell of sells) {
		const seller_id = sell["aid"];
	
		await config.Account.findOne({aid: seller_id}).exec().catch(err => {
			return console.log(err);
		}).then(async result => {
			if (!result) {
				return console.log(err);
			}

			await config.Company.findOne({ticker: sell["symbol"]}).exec().catch(err => {
				return console.log(err);
			}).then(async company_result => {
				if (!company_result) {
					return console.log(err);
				}

				let new_portfolio = {...result["portfolio"]};

				if (sell["symbol"] in Object.keys(new_portfolio)) {
					new_portfolio[sell["symbol"]] -= sell["shares"];
				}

				let sell_price = company_result["bid"]*sell["shares"];

				console.log("UPDATING ACCOUNT LINE 99, NEW ACCOUNT:");
				console.log({portfolio: new_portfolio, cash: result["cash"]+sell_price});
				await config.Account.updateOne({aid: seller_id}, {portfolio: new_portfolio, cash: result["cash"]+sell_price}).exec().catch(err => {
					return console.log(err);
				}).then(r => {
					payFee(company_result["ask"], company_result["bid"]);
					open_orders = open_orders.filter(o => o.oid != sell["oid"]);
				});
			});
		});
	}

	return true;
}

const executeSellOrder = async (sell, buys) => {
	const seller_id = sell["aid"];

	await config.Account.findOne({aid: seller_id}).exec().catch(err => {
		return console.log(err);
	}).then(async result => {
		if (!result) {
			return console.log(err);
		}

		await config.Company.findOne({ticker: sell["symbol"]}).exec().catch(err => {
			return console.log(err);
		}).then(async company_result => {
			if (!company_result) {
				return console.log(err);
			}

			let new_portfolio = {...result["portfolio"]};


			if (sell["symbol"] in Object.keys(new_portfolio)) {
				new_portfolio[sell["symbol"]] -= sell["shares"];
			} else {
				return console.log(err);
			}

			let sell_price = company_result["bid"]*sell["shares"];

			console.log("UPDATING ACCOUNT LINE 142, NEW ACCOUNT:");
			console.log({portfolio: new_portfolio, cash: result["cash"]-sell_price});

			await config.Account.updateOne({aid: seller_id}, {portfolio: new_portfolio, cash: result["cash"]-sell_price}).exec().catch(err => {
				return console.log(err);
			}).then(r => {
				payFee(company_result["ask"], company_result["bid"]);
				open_orders = open_orders.filter(o => o.oid != sell["oid"]);
			});
		});
	});


	for (buy of buys) {
		const buyer_id = buy["aid"];
	
		await config.Account.findOne({aid: buyer_id}).exec().catch(err => {
			return console.log(err);
		}).then(async result => {
			if (!result) {
				return console.log(err);
			}

			await config.Company.findOne({ticker: buy["symbol"]}).exec().catch(err => {
				return console.log(err);
			}).then(async company_result => {
				if (!company_result) {
					return console.log(err);
				}

				let new_portfolio = {...result["portfolio"]};

				if (buy["symbol"] in Object.keys(new_portfolio)) {
					new_portfolio[buy["symbol"]] += buy["shares"];
				} else {
					new_portfolio[buy["symbol"]] = buy["shares"];
				}

				let buy_price = company_result["ask"]*buy["shares"];

				console.log("UPDATING ACCOUNT LINE 182, NEW ACCOUNT:");
				console.log({portfolio: new_portfolio, cash: result["cash"]+buy_price});

				await config.Account.updateOne({aid: buyer_id}, {portfolio: new_portfolio, cash: result["cash"]+buy_price}).exec().catch(err => {
					return console.log(err);
				}).then(r => {
					payFee(company_result["ask"], company_result["bid"]);
					open_orders = open_orders.filter(o => o.oid != buy["oid"]);
				});
			});
		});
	}

	return true;

}

const handleOrder = (order) => {
	console.log("Handling Order");
	console.log(order);

	open_orders.push(order);
	let buys = open_orders.filter(o => o.side=="buy").sortBy("shares").reverse();
	let sells = open_orders.filter(o => o.side=="sell").sortBy("shares").reverse();
	
	let handled_orders = [];

	console.log("Buys");
	console.log(buys);

	console.log("Sells");
	console.log(sells);

	for (let i = 0; i < buys.length; i++) {
		let buy = buys[i];

		shares_left = buy["shares"];
		sells_used = [];

		for (let j = 0; j < sells.length; j++) {
			let sell = sells[j];
			
			if (sell["symbol"] == buy["symbol"] && sell["shares"] <= shares_left) {
				shares_left -= sell["shares"];
				console.log("Matched Buy And Sell");
				console.log("Shares Left");
				console.log(shares_left);
				sells_used.push(sell);
			}

			if (shares_left == 0) {
				break;
			}
		}

		if (shares_left == 0) {
			console.log("Executing Buy Order");
			console.log(buy);
			console.log(sells_used);
			
			handled_orders.push(buy);

			for (s of sells_used) {
				handled_orders.push(s);
			}

			executeBuyOrder(buy, sells_used);
		}
	}

	console.log("handled orders")
	console.log(handled_orders)

	buys = buys.filter(b => !handled_orders.map(o => o.oid).includes(b.oid)).sortBy("shares").reverse();
	sells = sells.filter(s => !handled_orders.map(o => o.oid).includes(s.oid)).sortBy("shares").reverse();
	
	console.log("new buys")
	console.log(buys)

	console.log("new sells")
	console.log(sells)

	for (let i = 0; i < sells.length; i++) {
		let sell = sells[i];

		shares_left = sell["shares"];
		buys_used = [];

		for (let j = 0; j < buys.length; j++) {
			let buy = buys[j];
			
			if (buy["symbol"] == sell["symbol"] && buy["shares"] <= shares_left) {
				shares_left -= buy["shares"];
				buys_used.push(buy);
			}

			if (shares_left == 0) {
				break;
			}
		}

		if (shares_left == 0) {
			console.log("Executing Sell Order");
			console.log(sell);
			console.log(sells_used);
			executeSellOrder(sell, buys_used);
		}
	}

//	let buys_left = open_orders.filter(o => o.side=="buy").sortBy("shares").reverse();
//	let sells_left = open_orders.filter(o => o.side=="sell").sortBy("shares").reverse();


//	let sum_buys = buys_left.map(b => b["shares"]).reduce((a, b) => a + b);
//	let sum_sells = sells_left.map(s => s["shares"]).reduce((a, b) => a + b);


};

const makeOrder = (req, res) => {
	const order = {
		oid: uuid.v4(),
		aid: req.body.aid,
		side: req.params.side,
		symbol: req.body.symbol,
		shares: req.body.shares
	};

	async.parallel([
		function(callback) {
			handleOrder(order);
		},
		function(callback) {
			res.json({message: "Order Created Successfully.", result: {"oid": order.oid}});
		}
	], function(err, results){});
}

const cancelOrder = (req, res) => {
	const oid = req.params.oid;

	for (let i = 0; i < open_orders.length; i++) {
		if (open_orders[i].oid == oid) {
			open_orders.splice(i, 1);
			i--;
			
			res.json({message: "Order Canceled Successfully.", result: {"oid": oid}});
	
			return;
		}
	} 

	return req.status(404).json({message: "Order Doesn't Exist.", result: {error: "Order Not Found"}});
}


router.post("/create/:side", makeOrder);
router.delete("/cancel/:oid", cancelOrder);

module.exports = router;
