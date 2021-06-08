const express = require("express");
const router = express.Router();
const uuid = require("uuid");
const config = require("../config");
const async = require("async");
const company = require("../models/company");

Array.prototype.sortBy = function (p) {
  return this.slice(0).sort(function (a, b) {
    return a[p] > b[p] ? 1 : a[p] < b[p] ? -1 : 0;
  });
};

const changePrice = async (symbol, pct_buy, pct_sell) => {
  if (pct_buy == pct_sell) {
    return;
  }

  let pct_diff;
  let dir;

  if (pct_buy > pct_sell) {
    dir = "up";
    pct_diff = (pct_buy - pct_sell) / pct_buy;
  } else if (pct_buy < pct_sell) {
    dir = "down";
    pct_diff = (pct_sell - pct_buy) / pct_sell;
  }

  await config.Company.findOne({ symbol: symbol })
    .exec()
    .catch((err) => {
      return console.log(err);
    })
    .then(async (result) => {
      let new_ask = result.ask;

      if (dir == "up") {
        new_ask *= 1 + pct_diff / 10;
      } else if (dir == "down") {
        new_ask *= 1 - pct_diff / 10;
      }

      // let new_bid = new_ask * (1 - config.spread);
      let new_bid = new_ask;

      await config.Company.updateOne(
        { symbol: symbol },
        { ask: new_ask, bid: new_bid }
      )
        .exec()
        .catch((err) => {
          return console.log(err);
        })
        .then((r) => {
          console.log("New Price: ", new_ask);
        });
    });
};

const payFee = async (ask, bid) => {
  await config.Account.findOne({ aid: config.MAKER_ID })
    .exec()
    .catch((err) => {
      return console.log(err);
    })
    .then(async (result) => {
      if (!result) {
        return;
      }

      await config.Account.updateOne(
        { aid: config.MAKER_ID },
        { cash: result.cash + (ask - bid) }
      )
        .exec()
        .catch((err) => {
          return console.log(err);
        })
        .then((r) => {
          return;
        });
    });
};

const executeOrder = async (main_order, attributing_orders) => {
  const main_id = main_order.aid;

  return new Promise(async (resolve, reject) => {
    await config.Account.findOne({ aid: main_id })
      .exec()
      .catch((err) => {
        reject(err);
      })
      .then(async (result) => {
        if (!result) {
          reject(err);
        }

        await config.Company.findOne({ symbol: main_order.symbol })
          .exec()
          .catch((err) => {
            2699;
          })
          .then(async (company_result) => {
            if (!company_result) {
              reject("Company Doesn't Exist.");
            }

            let new_portfolio = { ...result.portfolio };

            if (Object.keys(new_portfolio).includes(main_order.symbol)) {
              if (main_order.side == "buy") {
                new_portfolio[main_order.symbol] += main_order.shares;
              } else if (main_order.side == "sell") {
                new_portfolio[main_order.symbol] -= main_order.shares;
              }
            } else {
              if (main_order.side == "buy") {
                new_portfolio[main_order.symbol] = main_order.shares;
              }
              2699;
            }

            if (main_order.side == "buy") {
              if (
                new_portfolio[main_order.symbol] >=
                company_result.shares / 2
              ) {
                await config.Company.updateOne(
                  { symbol: main_order.symbol },
                  { owner: result.aid }
                )
                  .exec()
                  .catch((err) => {
                    reject(err);
                  })
                  .then((r) => {});
              }
            }

            let new_cash;
            let main_order_price;

            if (main_order.side == "buy") {
              main_order_price = company_result.ask * main_order.shares;
              new_cash = result.cash - main_order_price;
            } else if (main_order.side == "sell") {
              main_order_price = company_result.bid * main_order.shares;
              new_cash = result.cash + main_order_price;
            }

            await config.Account.updateOne(
              { aid: main_id },
              {
                portfolio: new_portfolio,
                cash: new_cash,
              }
            )
              .exec()
              .catch((err) => {
                reject(err);
              })
              .then(async (r) => {
                // payFee(
                //   company_result.ask * main_order.shares,
                //   company_result.bid * main_order.shares
                // );
                await config.Order.deleteOne({ oid: main_order.oid })
                  .exec()
                  .catch((err) => {
                    reject(err);
                  })
                  .then((r) => {});

                let aorder_resolutions_left = attributing_orders.length;

                for (let aorder of attributing_orders) {
                  const orderer_id = aorder.aid;

                  let promise = new Promise(
                    async (order_resolve, order_reject) => {
                      await config.Account.findOne({
                        aid: orderer_id,
                      })
                        .exec()
                        .catch((err) => {
                          order_reject(err);
                        })
                        .then(async (result) => {
                          if (!result) {
                            order_reject(err);
                          }

                          await config.Company.findOne({
                            symbol: aorder.symbol,
                          })
                            .exec()
                            .catch((err) => {
                              order_reject(err);
                            })
                            .then(async (company_result) => {
                              if (!company_result) {
                                order_reject(err);
                              }

                              let new_portfolio = {
                                ...result.portfolio,
                              };

                              if (
                                Object.keys(new_portfolio).includes(
                                  aorder.symbol
                                )
                              ) {
                                if (aorder.side == "buy") {
                                  new_portfolio[aorder.symbol] += aorder.shares;
                                } else if (aorder.side == "sell") {
                                  new_portfolio[aorder.symbol] -= aorder.shares;
                                }
                              } else {
                                console.log(
                                  `${aorder.symbol} not in ${Object.keys(
                                    new_portfolio
                                  )}`
                                );

                                if (aorder.side == "buy") {
                                  new_portfolio[aorder.symbol] = aorder.shares;
                                }
                              }

                              let aorder_price;
                              let new_cash;
                              if (aorder.side == "buy") {
                                aorder_price =
                                  company_result.ask * aorder.shares;
                                new_cash = result.cash - aorder_price;
                              } else if (aorder.side == "sell") {
                                aorder_price =
                                  company_result.bid * aorder.shares;
                                new_cash = result.cash + aorder_price;
                              }

                              await config.Account.updateOne(
                                {
                                  aid: orderer_id,
                                },
                                {
                                  portfolio: new_portfolio,
                                  cash: new_cash,
                                }
                              )
                                .exec()
                                .catch((err) => {
                                  order_reject(err);
                                })
                                .then(async (r) => {
                                  await config.Order.deleteOne({
                                    oid: aorder.oid,
                                  })
                                    .exec()
                                    .catch((err) => {
                                      order_reject(err);
                                    })
                                    .then((r) => {
                                      order_resolve(true);
                                    });
                                });
                            });
                        });
                    }
                  );
                  promise.then((r) => {
                    aorder_resolutions_left--;
                    if (aorder_resolutions_left == 0) {
                      resolve(true);
                    }
                  });
                }
              });
          });
      });
  });
};

const handleOrder = async (order) => {
  const new_order = config.Order(order);

  await new_order
    .save()
    .catch((err) => {
      return console.log(err);
    })
    .then(async (r) => {
      await config.Order.find()
        .exec()
        .catch((err) => {
          return console.log(err);
        })
        .then(async (open_orders) => {
          let handled_orders = [];
          let order_promises = [];

          for (let i = 0; i < open_orders.length; i++) {
            let order = open_orders[i];

            let shares_left = order.shares;
            let orders_used = [];

            for (let j = 0; j < open_orders.length; j++) {
              if (j == i) {
                continue;
              }

              let this_order = open_orders[j];

              if (handled_orders.includes(this_order)) {
                continue;
              }

              if (this_order.side == order.side) {
                continue;
              }

              if (this_order.shares <= shares_left) {
                shares_left -= this_order.shares;
                orders_used.push(this_order);
              }

              if (shares_left == 0) {
                break;
              }
            }

            if (shares_left == 0) {
              console.log("Executing Order");

              handled_orders.push(order);

              for (let o of orders_used) {
                handled_orders.push(o);
              }

              let promise = executeOrder(order, orders_used);
              order_promises.push(promise);
            }
          }

          let order_promises_left = order_promises.length;

          for (let order_promise of order_promises) {
            order_promise.then(async (r) => {
              order_promises_left--;
              if (order_promises_left == 0) {
                await config.Order.find()
                  .exec()
                  .catch((err) => {
                    return console.log(err);
                  })
                  .then((still_open_orders) => {
                    let buys_left = still_open_orders
                      .filter(
                        (o) => o.side == "buy" && o.symbol == order.symbol
                      )
                      .sortBy("shares")
                      .reverse();
                    let sells_left = still_open_orders
                      .filter(
                        (o) => o.side == "sell" && o.symbol == order.symbol
                      )
                      .sortBy("shares")
                      .reverse();

                    let sum_buys = 0;
                    let sum_sells = 0;

                    if (buys_left.length > 0) {
                      sum_buys = buys_left
                        .map((b) => b.shares)
                        .reduce((a, b) => a + b);
                    }

                    if (sells_left.length > 0) {
                      sum_sells = sells_left
                        .map((s) => s.shares)
                        .reduce((a, b) => a + b);
                    }

                    console.log("SUM BUYS: ", sum_buys);
                    console.log("SUM SELLS: ", sum_sells);

                    if (sum_buys == 0 || sum_sells == 0) {
                      return;
                    }

                    let pct_buy = sum_buys / (sum_buys + sum_sells);
                    let pct_sell = sum_sells / (sum_buys + sum_sells);

                    changePrice(order.symbol, pct_buy, pct_sell);
                  });
              }
            });
          }
        });
    });
};

const makeOrder = (req, res) => {
  const order = {
    oid: uuid.v4(),
    aid: req.body.aid,
    side: req.params.side,
    symbol: req.body.symbol,
    shares: req.body.shares,
  };

  handleOrder(order);
  res.json({
    message: "Order Created Successfully.",
    result: { oid: order.oid },
  });
};

const cancelOrder = async (req, res) => {
  const oid = req.params.oid;

  await config.Order.deleteOne({ oid: oid })
    .exec()
    .catch((err) => {
      return res
        .status(500)
        .json({ message: `Error: ${err}`, result: { error: err } });
    })
    .then((r) => {
      return res.json({
        message: "Order Canceled Successfully.",
        result: { oid: oid },
      });
    });
};

router.post("/create/:side", makeOrder);
router.delete("/cancel/:oid", cancelOrder);

module.exports = router;
