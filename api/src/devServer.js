"use strict";

const fs = require("fs");
const path = require("path");

const apiRoot = path.resolve(__dirname, "..");
const repositoryRoot = path.resolve(apiRoot, "..");
const dataDir = path.join(apiRoot, ".dev-data");

fs.mkdirSync(path.join(dataDir, "pickups"), { recursive: true });

process.env.NODE_ENV = "development";
process.env.PORT ||= "4000";
process.env.PUBLIC_DIR ||= repositoryRoot;
process.env.TFCBOT_DATA_DIR ||= dataDir;
process.env.ELO_DB ||= path.join(dataDir, "elo.db");
process.env.PICKUP_DB_USER ||= "local-dev";
process.env.PICKUP_DB_PASSWORD ||= "local-dev";
process.env.PICKUP_STORAGE_PATH ||= path.join(dataDir, "pickups");
process.env.PICKUP_UPLOAD_TOKEN ||= "local-dev-only";
process.env.PREDICTIONS_WEB_MODE ||= "off";

if (!fs.existsSync(process.env.ELO_DB)) {
  console.error("Local database not found. Run `npm run dev:seed` first.");
  process.exit(1);
}

require("./server");
