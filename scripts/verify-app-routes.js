const assert = require("assert/strict");
const { app } = require("../backend/server");

async function verify() {
  const server = app.listen(0, "127.0.0.1");
  await new Promise((resolve, reject) => {
    server.once("listening", resolve);
    server.once("error", reject);
  });

  try {
    const { port } = server.address();
    const baseUrl = `http://127.0.0.1:${port}`;
    const cases = [
      { path: "/legal-registry", status: 200, contains: "<title>ESQ \uBC95\uADDC\uB4F1\uB85D\uBD80</title>" },
      { path: "/safety", status: 200, contains: "<title>ESQ \uC548\uC804\uC0AC\uACE0 \uAD00\uB9AC</title>" },
      { path: "/LEGAL-REGISTRY", status: 302, location: "/legal-registry" },
      { path: "/Legal-Registry/?source=test", status: 302, location: "/legal-registry?source=test" },
      { path: "/SAFETY", status: 302, location: "/safety" },
      { path: "/Safety/?source=test", status: 302, location: "/safety?source=test" },
      { path: "/", status: 302, location: "/legal-registry", headers: { "X-Forwarded-Host": "port-0-ohyoung-legal-registry.example.com" } },
      { path: "/", status: 302, location: "/safety", headers: { "X-Forwarded-Host": "port-0-esq-safety.example.com" } }
    ];

    for (const testCase of cases) {
      const response = await fetch(`${baseUrl}${testCase.path}`, { redirect: "manual", headers: testCase.headers });
      assert.equal(response.status, testCase.status, `${testCase.path} status`);
      if (testCase.location) {
        const location = response.headers.get("location");
        assert.equal(new URL(location, baseUrl).pathname + new URL(location, baseUrl).search, testCase.location, `${testCase.path} redirect`);
      }
      if (testCase.contains) {
        const html = await response.text();
        assert.ok(html.includes(testCase.contains), `${testCase.path} served the wrong app`);
      }
    }

    console.log("Route verification passed: safety and legal registry are isolated.");
  } finally {
    await new Promise((resolve) => server.close(resolve));
  }
}

verify().catch((error) => {
  console.error(error.stack || error.message);
  process.exitCode = 1;
});
