const { loadConfig } = require("./config");
const { createDatabase } = require("./database");
const { createApiServer } = require("./api");

const config = loadConfig();
const database = createDatabase(config.dbPath);
const server = createApiServer({ config, database });

server.listen(config.port, config.host, () => {
  console.log(`知练同步服务已启动：http://${config.host}:${config.port}`);
});

function shutdown(signal) {
  console.log(`收到 ${signal}，正在停止服务`);
  server.close(() => {
    database.close();
    process.exit(0);
  });
  setTimeout(() => process.exit(1), 10000).unref();
}

process.on("SIGTERM", () => shutdown("SIGTERM"));
process.on("SIGINT", () => shutdown("SIGINT"));
