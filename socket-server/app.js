import { start } from "./src/server.js";

console.log("[app] FlowDrop socket app loaded", {
  nodeEnv: process.env.NODE_ENV || "development",
  port: process.env.PORT || "3000",
});

start();
