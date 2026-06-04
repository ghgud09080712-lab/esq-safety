const { spawn } = require("child_process");

const target = String(process.argv[2] || process.env.APP_TARGET || "safety").toLowerCase();
const pathByTarget = {
  safety: "/safety",
  legal: "/legal-registry",
  "legal-registry": "/legal-registry"
};
const url = process.env.APP_URL || `http://127.0.0.1:4173${pathByTarget[target] || pathByTarget.safety}`;
spawn("cmd", ["/c", "start", "", url], {
  detached: true,
  stdio: "ignore"
}).unref();
