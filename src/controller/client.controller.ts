/**
 * Copyright 2021 TM9657 GmbH. All Rights Reserved.
 *
 * Controls Instances of all relevant classes.
 */

import APIController from "./api.controller.js";
import SettingsController from "./settings.controller.js";
import TorrentController from "./torrent.controller.js";
import SocketController from "./socket.controller.js";
import LogController from "./log.controller.js";
export default class ClientController {
  torrent: TorrentController = null;
  settings: SettingsController = null;
  api: APIController = null;
  socket: SocketController = null;
  log: LogController = null;
  private internal_config: config = null;

  constructor(config: config) {
    this.internal_config = config;
    this.log = new LogController();
    this.socket = new SocketController(this);
    this.torrent = new TorrentController(this);
    this.settings = new SettingsController(this);
    this.api = new APIController(this);
    this.init();
  }

  private async init() {
    /**
     * Torrent Logic
     */
    await this.torrent.init();

    /**
     * Saving meta data and torrent
     * keys as well as hashes
     */
    await this.settings.init();

    /**
     * API Requests
     * currently not used, for later use
     */
    await this.api.init();

    /**
     * Websocket Connection
     * for the communication with the client portal user
     */
    await this.socket.init(
      this.internal_config.API,
      this.internal_config.SECRET,
      this.internal_config.USER
    );
  }

  config() {
    return this.internal_config;
  }
}
