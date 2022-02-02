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
    payload: { hash: string; jwt: string },
    client: ClientController
  ) {
    client.settings.inventory().add(payload.hash, payload.jwt);
    client.socket.publish("sendServer", "server", "confirm jwt", {
      server: client.config().API,
      hash: payload.hash,
    });
  },
};
