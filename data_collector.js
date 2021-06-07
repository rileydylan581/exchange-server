const config = require("./config");
const async = require("async");

const collect = async () => {	
	console.log("collect()");
	await config.Company.find({}).exec().catch(err => {
		console.log(err);
	}).then(companies => {
		companies.forEach(async company => {
			await config.Minute.findOne({symbol: company.symbol}).catch(err => {
				console.log(err);
			}).then(async result => {
				if (!result) {
					return;
				}

				let new_prices = [...result.prices];
			
				new_prices.push({datetime: new Date(), price: company.ask});

				console.log("NEW DATA FOR ",company.symbol);
				console.log(new_prices);

				await config.Minute.updateOne({symbol: company.symbol}, {prices: new_prices}).exec().catch(err => {
					console.log(err);
				}).then(r => {});
			})
		});
	});
}

const start = () => {
	let now = new Date();
	setTimeout(function () {
		setInterval(collect, 60000);
		console.log("SET INTERVAL");
	}, (60-now.getSeconds())*1000);

	console.log("SET TIMEOUT");
}

exports.start = start;
