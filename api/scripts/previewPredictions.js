"use strict";

// Deliberately does not load config/.env, existing application or any database.
const path = require("path");
const express = require("express");
const { createPredictionsRouter } = require("../src/predictions/router");
const { securityHeaders } = require("../src/middleware/securityHeaders");
const app = express();
app.disable("x-powered-by");
app.use(securityHeaders);
app.use((req, res, next) => { res.setHeader("X-Robots-Tag", "noindex, nofollow"); next(); });
app.use("/api/predictions", createPredictionsRouter({ mode: "preview" }));
// Shared main.js expects these public shell endpoints. Keep this preview synthetic.
app.get(["/api/supporters", "/api/queue", "/api/players"], (req, res) => res.json({ ok: true, data: [] }));
app.use("/assets", express.static(path.resolve(__dirname, "../../assets")));
for (const page of ["predictions.html", "prediction-rules.html"]) {
  app.get(`/${page}`, (req, res) => res.sendFile(path.resolve(__dirname, "../..", page)));
}
app.get("/", (req, res) => res.redirect("/predictions.html"));
const server = app.listen(4173, "127.0.0.1", () => console.log("Synthetic prediction preview: http://127.0.0.1:4173/predictions.html"));
process.on("SIGINT", () => server.close());
process.on("SIGTERM", () => server.close());
