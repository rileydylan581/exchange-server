const express = require("express");
const cors = require("cors");
const bodyParser = require("body-parser");
const WebSocket = require("ws");
const config = require("./config");

app = express();

app.use(cors());
app.use(bodyParser.json());

const accountRoutes = require("./routes/account-routes");
const companyRoutes = require("./routes/company-routes");
//const tradeRoutes = require("./routes/trade-routes");

app.use("/accounts", accountRoutes);
app.use("/companies", companyRoutes);
//app.use("/trade", tradeRoutes);

const server = app.listen(config.PORT, () => {
	console.log(`Listening On Port ${config.PORT}...`);
});
