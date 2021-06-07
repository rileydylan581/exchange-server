const express = require("express");
const router = express.Router();
const uuid = require("uuid");
const config = require("../config");
const async = require("async");

Array.prototype.sortBy = function(p) {

  return this.slice(0).sort(function(a,b) {

    return (a[p] > b[p]) ? 1 : (a[p] < b[p]) ? -1 : 0;

  });

}

const changePrice = async (symbol, pct_buy, pct_sell) => {
	if (pct_buy == pct_sell) {
		return;
	}


	let pct_diff;
	let dir;

	if (pct_buy > pct_sell) {
		dir = "up";
		pct_diff = (pct_buy - pct_sell)/pct_buy;
	} else if (pct_buy < pct_sell) {
		dir = "down";
		pct_diff = (pct_sell - pct_buy)/pct_sell;
	}

	await config.Company.findOne({symbol: symbol}).exec().catch(err => {
		return console.log(err);
	}).then(async result => {

		let new_ask = result.ask;

		if (dir == "up") {
			new_ask *= 1+(pct_diff/10);
		} else if (dir == "down") {
			new_ask *= 1-(pct_diff/10);
		}

		let new_bid = new_ask * (1-config.spread);


		await config.Company.updateOne({symbol: symbol}, {ask: new_ask, bid: new_bid}).exec().catch(err => {
			return console.log(err);
		}).then(r => {
			console.log("New Price: ",new_ask);
		});
	});
}

const payFee = async (ask, bid) => {
	await config.Account.findOne({aid: config.MAKER_ID}).exec().catch(err => {
		return console.log(err);
	}).then(async result => {
		if (!result) {
			return;
		}

		await config.Account.updateOne({aid: config.MAKER_ID}, {cash: result.cash+(ask-bid)}).exec().catch(err => {
			return console.log(err);
		}).then(r => {
			return;
		});	
	});
}

const executeBuyOrder = async (buy, sells) => {
	const buyer_id = buy.aid;

	return new Promise((resolve, reject) => {await config.Account.findOne({aid: buyer_id}).exec().catch(err => {
		return console.log(err);
	}).then(async result => {
		if (!result) {
			return console.log(err);
		}

		await config.Company.findOne({symbol: buy.symbol}).exec().catch(err => {
			return console.log(err);
		}).then(async company_result => {
			if (!company_result) {
				return console.log(err);
			}

			let new_portfolio = {...result.portfolio};


			if (Object.keys(new_portfolio).includes(buy.symbol)) {
				new_portfolio[buy.symbol] += buy.shares;
			} else {
				new_portfolio[buy.symbol] = buy.shares;
			}


			if (new_portfolio[buy.symbol] >= company_result.shares/2) {
				await config.Company.updateOne({symbol: buy.symbol}, {owner: result.aid}).exec().catch(err => {
					return console.log(err);
				}).then(r => {});
			}

			let buy_price = company_result.ask*buy.shares;
			console.log("UPDATING ACCOUNT LINE 62, NEW ACCOUNT:");
			console.log({portfolio: new_portfolio, cash: result.cash-buy_price})
			await config.Account.updateOne({aid: buyer_id}, {portfolio: new_portfolio, cash: result.cash-buy_price}).exec().catch(err => {
				return console.log(err);
			}).then(async r => {
				payFee(company_result.ask*buy.shares, company_result.bid*buy.shares);
				await config.Order.deleteOne({oid: buy.oid}).exec().catch(err => {
					return console.log(err);
				}).then(r=>{});
				let sell_promises = [];
				for (sell of sells) {
					const seller_id = sell.aid;
					
					let promise = new Promise((sell_resolve, sell_reject) => {await config.Account.findOne({aid: seller_id}).exec().catch(err => {
						return console.log(err);
					}).then(async result => {
						if (!result) {
							return console.log(err);
						}

						await config.Company.findOne({symbol: sell.symbol}).exec().catch(err => {
							return console.log(err);
						}).then(async company_result => {
							if (!company_result) {
								return console.log(err);
							}

							let new_portfolio = {...result.portfolio};

							if (Object.keys(new_portfolio).includes(sell.symbol)) {
								console.log(`${sell.symbol} in ${Object.keys(new_portfolio)}`);
								new_portfolio[sell.symbol] -= sell.shares;
							} else {
								console.log(`${sell.symbol} not in ${Object.keys(new_portfolio)}`);
							}

							let sell_price = company_result.bid*sell.shares;

							console.log("UPDATING ACCOUNT LINE 99, NEW ACCOUNT:");
							console.log({portfolio: new_portfolio, cash: result.cash+sell_price});
							await config.Account.updateOne({aid: seller_id}, {portfolio: new_portfolio, cash: result.cash+sell_price}).exec().catch(err => {
								return console.log(err);
							}).then(async r => {
								await config.Order.deleteOne({oid: sell.oid}).exec().catch(err => {
									return console.log(err);
								}).then(r=>{sell_resolve(true)});
							});
						});
					})});
					promise.then((res) => {
						promise.done = true;
					})
					sell_promises.push(promise);
				}

				while (true) {
					let done = true;
					for (let p of sell_promises) {
						if (!p.done) {
							done = false;
							break;
						}
					}
					if (done) {
						break;
					}
				}

				resolve(true);
				

			});
		});
	})});
}

const executeSellOrder = async (sell, buys) => {
	const seller_id = sell.aid;

	return new Promise((resolve, reject) => {await config.Account.findOne({aid: seller_id}).exec().catch(err => {
		return console.log(err);
	}).then(async result => {
		if (!result) {
			return console.log(err);
		}

		await config.Company.findOne({symbol: sell.symbol}).exec().catch(err => {
			return console.log(err);
		}).then(async company_result => {
			if (!company_result) {
				return console.log(err);
			}

			let new_portfolio = {...result.portfolio};


			if (Object.keys(new_portfolio).includes(sell.symbol)) {
				new_portfolio[sell.symbol] -= sell.shares;
			} else {
				return console.log(err);
			}

			let sell_price = company_result.bid*sell.shares;

			console.log("UPDATING ACCOUNT LINE 142, NEW ACCOUNT:");
			console.log({portfolio: new_portfolio, cash: result.cash+sell_price});

			await config.Account.updateOne({aid: seller_id}, {portfolio: new_portfolio, cash: result.cash+sell_price}).exec().catch(err => {
				return console.log(err);
			}).then(async r => {
				payFee(company_result.ask*sell.shares, company_result.bid*sell.shares);
				await config.Order.deleteOne({oid: sell.oid}).exec().catch(err => {
					return console.log(err);
				}).then(r=>{});

				let buy_promises = [];

				for (buy of buys) {
					const buyer_id = buy.aid;
				
					let promise = new Promise((buy_resolve, buy_reject) => {await config.Account.findOne({aid: buyer_id}).exec().catch(err => {
						return console.log(err);
					}).then(async result => {
						if (!result) {
							return console.log(err);
						}

						await config.Company.findOne({symbol: buy.symbol}).exec().catch(err => {
							return console.log(err);
						}).then(async company_result => {
							if (!company_result) {
								return console.log(err);
							}

							let new_portfolio = {...result.portfolio};

							if (Object.keys(new_portfolio).includes(buy.symbol)) {
								new_portfolio[buy.symbol] += buy.shares;
							} else {
								new_portfolio[buy.symbol] = buy.shares;
							}
						
							if (new_portfolio[buy.symbol] >= company_result.shares/2) {
								await config.Company.updateOne({symbol: buy.symbol}, {owner: result.aid}).exec().catch(err => {
									return console.log(err);
								}).then(r => {});
							}

							let buy_price = company_result.ask*buy.shares;

							console.log("UPDATING ACCOUNT LINE 182, NEW ACCOUNT:");
							console.log({portfolio: new_portfolio, cash: result.cash-buy_price});

							await config.Account.updateOne({aid: buyer_id}, {portfolio: new_portfolio, cash: result.cash-buy_price}).exec().catch(err => {
								return console.log(err);
							}).then(async r => {
								await config.Order.deleteOne({oid: buy.oid}).exec().catch(err => {
									return console.log(err);
								}).then(r=>{promise.resolve(true);});
							});
						});
					})});

					promise.then(r => {
						promise.done = true;
					});
					buy_promises.push(promise);
				}
				
				while (true) {
					let done = true;
					for (p in buy_promises) {
						if (!p.done) {
							done = false;
							break;
						}
					}
					if (done) {
						break;
					}
				}

				resolve(true);

			});
		});
	})});


}

const handleOrder = async (order) => {
	console.log("Handling Order");
	console.log(order);

	const new_order = config.Order(order);

	await new_order.save().catch(err => {
		return console.log(err);
	}).then(async r => {
		await config.Order.find().exec().catch(err => {
			return console.log(err);
		}).then(async open_orders => {
			let buys = open_orders.filter(o => o.side=="buy" && o.symbol==order.symbol).sortBy("shares").reverse();
			let sells = open_orders.filter(o => o.side=="sell" && o.symbol==order.symbol).sortBy("shares").reverse();
			
			let handled_orders = [];

			console.log("Buys");
			console.log(buys);

			console.log("Sells");
			console.log(sells);

			let buy_promises = [];

			for (let i = 0; i < buys.length; i++) {
				let buy = buys[i];

				shares_left = buy.shares;
				sells_used = [];

				for (let j = 0; j < sells.length; j++) {
					let sell = sells[j];
					
					if (sell.shares <= shares_left) {
						shares_left -= sell.shares;
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

					let res = executeBuyOrder(buy, sells_used, open_orders);
					res.then(r => {
						res.done = true;
					});
					buy_promises.push(res);
				}
			}

			let done = true;
			while (true) {
				for (promise of buy_promises) {
					if (!promise.done) {
						done = false;
						break;
					}
				}
				if (done) {
					break;
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

			let sell_promises = [];

			for (let i = 0; i < sells.length; i++) {
				let sell = sells[i];

				shares_left = sell.shares;
				buys_used = [];

				for (let j = 0; j < buys.length; j++) {
					let buy = buys[j];
					
					if (buy.shares <= shares_left) {
						shares_left -= buy.shares;
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
					let res = executeSellOrder(sell, buys_used, open_orders);
					res.then(r => {
						res.done = true;
					});
					sell_promises.push(res);
				}
			}
			
			let done = true;
			while (true) {
				for (promise of sell_promises) {
					if (!promise.done) {
						done = false;
						break;
					}
				}
				if (done) {
					break;
				}
			}

			await config.Order.find().exec().catch(err => {
				return console.log(err);
			}).then(still_open_orders => {
				let buys_left = still_open_orders.filter(o => o.side=="buy" && o.symbol==order.symbol).sortBy("shares").reverse();
				let sells_left = still_open_orders.filter(o => o.side=="sell" && o.symbol==order.symbol).sortBy("shares").reverse();


				let sum_buys = 0;
				let sum_sells = 0;

				if (buys.length > 0) {
					sum_buys = buys_left.map(b => b.shares).reduce((a, b) => a + b);
				}

				if (sells_left.length > 0) {
					sum_sells = sells_left.map(s => s.shares).reduce((a, b) => a + b);
				}

				console.log("SUM BUYS: ",sum_buys);
				console.log("SUM SELLS: ",sum_sells);

				if (sum_buys == 0 || sum_sells == 0) {
					return;
				}

				let pct_buy = sum_buys / (sum_buys+sum_sells);
				let pct_sell = sum_sells / (sum_buys+sum_sells);

				changePrice(order.symbol, pct_buy, pct_sell);

			});

			
		});
	});
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

const cancelOrder = async (req, res) => {
	const oid = req.params.oid;

	await config.Order.deleteOne({oid: oid}).exec().catch(err => {
		return res.status(500).json({message: `Error: ${err}`, result: {error: err}});
	}).then(r => {
		return res.json({message: "Order Canceled Successfully.", result: {"oid": oid}});
	});
}


router.post("/create/:side", makeOrder);
router.delete("/cancel/:oid", cancelOrder);

module.exports = router;
