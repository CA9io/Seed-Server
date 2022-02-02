/**
 * Copyright 2021 TM9657 GmbH. All Rights Reserved.
 *
 * Manages the current Inventory of Torrent Items
 * as well as Metadata. Saves those things and loads them in case
 * of server restarts.
 */

import ClientController from "./client.controller.js";
import fs from "fs";
export default class SettingsController {
  private client: ClientController;
  private mode_state: "all" | "selected";
  private inventory_state: Map<string, { jwt: string; ttl: number }>;
  private stats: Stats = {
    upload: { total: 0, last: 0 },
    download: { total: 0, last: 0 },
    connected: 0,
    torrents: 0,
    speeds: { download: 0, upload: 0 },
    system: { CPU: 0, RAM: 0, Space: { free: 0, available: 0 } },
  };
  constructor(client: ClientController) {
    this.mode_state = "all";
    this.inventory_state = new Map();
    this.client = client;
  }

  async init() {
    await this.load();
  }

  mode() {}

  /**
   * fetches the current inventory and allows to add items or remove them
   */
  inventory() {
    let gThis = this;
    let inventory = this.inventory_state;

    const add = (hash: string, jwt: string) => {
      gThis.inventory_state.set(hash, {
        jwt,
        ttl: Date.now() + 30 * 24 * 60 * 60 * 1000,
      });
      gThis.client.torrent.seed(hash, jwt);
    };

    const remove = (hash: string) => {
      gThis.inventory_state.delete(hash);
    };

    const has = (hash: string) => {
      if (!gThis.inventory_state.has(hash)) {
        return false;
      }
      if (Date.now() > gThis.inventory_state.get(hash).ttl) {
        remove(hash);
        return false;
      }
      return true;
    };

    return {
      inventory,
      add,
      remove,
      has,
    };
  }

  save() {
    //serialize Map and save to file
    fs.writeFileSync(
      "./save.json",
      JSON.stringify({
        mode: this.mode_state,
        inventory: Array.from(this.inventory_state),
        stats: this.client.torrent.stats().get(),
      }),
      "utf-8"
    );
  }

  async load() {
    let data: {
      mode: "all" | "selected";
      inventory: Map<string, { jwt: string; ttl: number }>;
      stats: Stats;
    };
    try {
      data = JSON.parse(await fs.promises.readFile("./save.json", "utf-8"));

      //deserialize map
      data.inventory = new Map(data.inventory);
    } catch (error) {
      return;
    }

    this.inventory_state = data.inventory;
    this.mode_state = data.mode;
    this.stats = data.stats;
    this.client.torrent.stats().set(this.stats);

    this.reload();
  }

  private async reload() {
    this.inventory().inventory.forEach((value, key) => {
      if (this.inventory().has(key)) {
        this.client.torrent.seed(key, value.jwt);
      }
    });
  }
}
