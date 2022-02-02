/**
 * Copyright 2021 TM9657 GmbH. All Rights Reserved.
 *
 * Returns the current status of the server to the user.
 */

import WebSocket from "ws";
import ClientController from "../../controller/client.controller.js";

export default {
  description: "adds hash and jwt",
  execute(
    connection: WebSocket,
    payload: {
      page?: number;
      filter?: "all" | "info" | "warn" | "error" | "time";
    },
    client: ClientController
  ) {
    let filter = payload.filter ?? "all";
    let page = payload.page ?? 0;

    client.socket.publish("sendServer", "server", "logs", {
      server: client.config().API,
      logs: client.log.get(filter, page),
      filter,
      page,
    });
  },
};
