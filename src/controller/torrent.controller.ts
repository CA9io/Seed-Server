/**
 * Copyright 2021 TM9657 GmbH. All Rights Reserved.
 *
 * Connects the user to the Torrent Network and
 * manages added torrent seeds.
 */

import ClientController from "./client.controller.js";
import path from "path";
import fs from "fs";
import WebTorrent from "webtorrent";
import wrtc from "wrtc";
import os from "os-utils";
import checkDiskSpace from "check-disk-space";
globalThis.WRTC = wrtc;

declare global {
  type Stats = {
    upload: { total: number; last: number };
    download: { total: number; last: number };
    connected: number;
    torrents: number;
    speeds: { download: number; upload: number };
    system: {
      CPU: number;
      RAM: number;
      Space: { free: number; available: number };
    };
  };
}
declare global {
  var WRTC: any;
  var WEBTORRENT_ANNOUNCE: any;
}
export default class TorrentController {
  private client: ClientController;
  private torrent_client: WebTorrent.Instance;
  private announces: string[] = [];
  private torrents: Map<string, { jwt: string; torrent: WebTorrent.Torrent }> =
    new Map();
  private save_path = "";
  private internal_stats: Stats = {
    upload: { total: 0, last: 0 },
    download: { total: 0, last: 0 },
    connected: 0,
    torrents: 0,
    speeds: { download: 0, upload: 0 },
    system: { CPU: 0, RAM: 0, Space: { free: 0, available: 0 } },
  };

  private speed_measurement = { upload: 0, download: 0 };

  constructor(client: ClientController) {
    this.client = client;
    this.announces = this.client.config().TORRENT_ANNOUNCES;
    console.log();
    this.save_path = path.normalize(this.client.config().DEFAULT_PATH);
    this.client.log.log("Torrent", `save directory: ${this.save_path}`)
    this.speed(0);
  }

  async speed(iteration: number) {
    (this.internal_stats.speeds.download =
      this.internal_stats.download.total - this.speed_measurement.download),
      (this.internal_stats.speeds.upload =
        this.internal_stats.upload.total - this.speed_measurement.upload);

    this.speed_measurement.download = this.internal_stats.download.total;
    this.speed_measurement.upload = this.internal_stats.upload.total;
    this.internal_stats;

    if (iteration % 60 === 0 || iteration === 0) {
      checkDiskSpace(
        path.normalize(path.resolve(this.client.config().DEFAULT_PATH))
      ).then((diskSpace) => {
        this.internal_stats.system.Space.free = diskSpace.free;
        this.internal_stats.system.Space.available = diskSpace.size;
        this.client.settings.save();
      });
    }

    this.internal_stats.system.RAM = os.freemem() / os.totalmem();

    os.cpuUsage((v) => {
      this.internal_stats.system.CPU = v;
    });

    setTimeout(() => {
      this.speed(iteration++);
    }, 1000);
  }

  async init() {
    this.torrent_client = new WebTorrent({
      dht: false,
      tracker: {
        rtcConfig: {
          iceServers: this.client.config().ICE,
          sdpSemantics: "unified-plan",
          bundlePolicy: "max-bundle",
          iceCandidatePoolsize: 1,
        },
      },
    });
  }

  stats() {
    const set = (stats: Stats) => {
      this.internal_stats = stats;
    };

    const get = () => {
      return this.internal_stats;
    };

    return { set, get };
  }

  async seed(hash: string, jwt: string) {
    this.client.log.log("torrent", `now trying to seed: ${hash}`);
    if (this.torrents.has(hash)) {
      try {
        // removed rescan. Can be very resource intensive and crash smaller seed server.
        //@ts-ignore this one is missing in the types file sadly
        //if(typeof this.torrents.get(hash).torrent !== "undefined") this.torrents.get(hash).torrent.rescanFiles();
      } catch (error) {
        this.client.log.error("torrent", error);
      }
      return;
    }
    this.torrents.set(hash, { jwt, torrent: undefined });
    let torrent: WebTorrent.Torrent;
    let torrent_path = path.normalize(
      path.join(this.save_path,"torrents", `${hash}.torrent`)
    );
    let save_path = path.normalize(
      path.join(this.save_path, "torrents", hash)
    );

    try {
      fs.mkdirSync(save_path, {recursive: true})
    } catch (error) {
    }

    if (fs.existsSync(torrent_path)) {
      try {
        torrent = this.torrent_client.add(torrent_path, {
          announce: this.announces,
          getAnnounceOpts: function () {
            return {
              token: jwt,
            };
          },
          path: save_path,
        });
      } catch (error) {
        console.log(error)
        this.client.log.error("torrent", error);
        return;
      }
    } else {
      try {
        torrent = this.torrent_client.add(`magnet:?xt=urn:btih:${hash}`, {
          announce: this.announces,
          getAnnounceOpts: function () {
            return {
              token: jwt,
            };
          },
          path: save_path,
        });
      } catch (error) {
        console.log(error)
        this.client.log.error("torrent", error);
        return;
      }
    }

    torrent.on("ready", () => {
      try {
        if (!fs.existsSync(torrent_path)) {
          fs.writeFileSync(torrent_path, torrent.torrentFile);
        }
        this.torrents.set(hash, { jwt, torrent: torrent });
      } catch (error) {}
    });
    this.handleTorrent(torrent);
  }

  private handleTorrent(torrent: WebTorrent.Torrent) {
    torrent.on("upload", (bytes: number) => {
      this.internal_stats.upload.total += bytes;
      this.internal_stats.upload.last += bytes;
    });

    torrent.on("download", (bytes: number) => {
      this.internal_stats.download.total += bytes;
      this.internal_stats.download.last += bytes;
    });
    torrent.on("error", (err: any) => {
      console.log(err)
      this.client.log.error("Torrent", err)
    });

    torrent.on("wire", (wire: any) => {
      wire.setKeepAlive(false);
      this.client.log.log("torrent", `user connected`);
      this.internal_stats.connected++;
    });
  }
}
