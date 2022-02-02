/**
 * Copyright 2021 TM9657 GmbH. All Rights Reserved.
 *
 * Returns the current status of the server to the user.
 */
import WebSocket from "ws";
import ClientController from "../../controller/client.controller.js";

export default {
  description: "Returns status",
  execute(connection: WebSocket, payload: any, client: ClientController) {
    client.socket.publish("sendServer", "server", "pong", {
      server: client.config().API,
      uptime: Date.now() - client.log.uptime,
    });
  },
};
