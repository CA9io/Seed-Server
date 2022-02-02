/**
 * Copyright 2021 TM9657 GmbH. All Rights Reserved.
 *
 * Returns the current status of the server to the user.
 */

import WebSocket from "ws";
import ClientController from "../../controller/client.controller.js";

export default {
  description: "adds hash and jwt",
  execute(connection: WebSocket, payload: any, client: ClientController) {
    client.socket.publish("sendServer", "server", "stats", {
      server: client.config().API,
      stats: client.torrent.stats().get(),
    });
  },
};
