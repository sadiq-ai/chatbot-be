// Load Enviroment
require("dotenv").config();
// require("./init_mongo");
const express = require("express");
const cors = require("cors");
const os = require("os");
const fs = require("fs");
const https = require("https");
const bodyParser = require("body-parser");
// Controllers
const controller = require("./controller");

// App
let app = express();
app.use(bodyParser.json({ limit: "20mb" }));
app.use(bodyParser.urlencoded({ limit: "20mb", extended: true }));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cors({ origin: "*" }));
let PORT = process.env.PORT;
let ip_address;
// Fetch local IP address
const networkInterfaces = os.networkInterfaces();
for (let interface in networkInterfaces) {
  for (let interfaceInfo of networkInterfaces[interface]) {
    if (interfaceInfo.family === "IPv4" && !interfaceInfo.internal) {
      ip_address = interfaceInfo.address;
    }
  }
}

app.get("/test", (req, res) => res.send("Hello World"));
app.post("/talk-to-ai", controller.addVoiceMessage);

app.listen(PORT, () => console.log("Server running on " + ip_address + ":" + PORT));

// Add https config
// const config = {
//   key: fs.readFileSync("/home/sadiq_server/domain_ssl_rsa.key"),
//   cert: fs.readFileSync("/home/sadiq_server/domain_ssl.cert"),
// };
// https.createServer(config, app).listen(PORT, () => {
//   console.log("HTTPS Server running on " + ip_address + ":" + PORT);
// });
