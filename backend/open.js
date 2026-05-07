const { spawn } = require("child_process");

const url = process.env.APP_URL || "http://127.0.0.1:4173/app";
spawn("cmd", ["/c", "start", "", url], {
  detached: true,
  stdio: "ignore"
}).unref();
