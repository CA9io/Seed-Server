/**
 * Copyright 2021 TM9657 GmbH. All Rights Reserved.
 *
 * Websocket communicating with the client.
 * Uses the CA9.io backend. No Port Forwarding necessary.
 */

import fs from "fs";
import path from "path";
import WebSocket from "ws";
import ClientController from "./client.controller.js";
import LogController from "./log.controller.js";

type Function = {
  default: {
    description: string;
    execute: (
      connection: WebSocket,
      payload: any,
      client: ClientController
    ) => void;
  };
};

export default class SocketController {
  private routes: Map<string, Map<string, Function>> = new Map();
  private client: ClientController = null;
  private socket: WebSocket = null;
  private timeout;
  private open: boolean = false;
  private log: LogController = null;
  private back_off = 1;
  constructor(client: ClientController) {
    this.client = client;
    this.log = this.client.log;

    this.init_routes();
  }

  async init(key: string, secret: string, sub: string) {
    this.init_socket(key, secret, sub);
  }

  private async init_routes() {
    this.log.time("socket controller init", "fetch routes");
    const routes_dir = path.normalize(path.resolve("./dist/routes/"));

    let routes = fs.readdirSync(routes_dir);

    for await (const route of routes) {
      let route_path = path.normalize(path.join(routes_dir, route));

      if (!fs.lstatSync(route_path).isDirectory()) {
        // just a file, return
        return;
      }

      let methods = fs
        .readdirSync(route_path)
        .filter((file: string) => file.endsWith(".js"));
      for await (const method of methods) {
        this.log.log(
          "socket, methods",
          `found route: [${route}] for method: [${path.parse(method).name}]`
        );

        let route_methods: Map<string, Function> = new Map();

        if (this.routes.has(route)) {
          route_methods = this.routes.get(route);
        }

        route_methods.set(
          path.parse(method).name,
          await import(`../routes/${route}/${method}`)
        );

        this.routes.set(route, route_methods);
      }
    }
    this.log.time("socket controller init", "fetch routes");
  }

  private heartbeat() {
    clearTimeout(this.timeout);
    this.open = true;
    this.timeout = setTimeout(() => {
      this.log.time("socket connection", "heartbeat");
      this.socket.ping();
      this.timeout = setTimeout(() => {
        this.socket.terminate();
        this.open = false;
      }, 30000 + 1000);
    }, 30000 + 1000);
  }

  private async init_socket(key: string, secret: string, sub: string) {
    this.socket = new WebSocket(
      `${process.env.WEBSOCKET_ENDPOINT}/?token=${encodeURI(
        Buffer.from(
          JSON.stringify({
            sub: sub,
            key: key,
            secret: secret,
          })
        ).toString("base64")
      )}`
    );

    this.socket.on("open", () => {
      this.log.log("socket connection", `connection successful`);
      this.back_off = 1;
      this.heartbeat();
    });

    this.socket.on("ping", () => this.heartbeat());
    this.socket.on("pong", () => {
      this.log.time("socket connection", "heartbeat");
      this.heartbeat();
    });

    this.socket.on("close", (code, reason) => {
      this.open = false;
      clearTimeout(this.timeout);

      this.log.warn(
        "socket connection",
        `socket closed, reason: ${reason.toString()}[${code}], reconnecting in 2 seconds`
      );
      setTimeout(() => {
        this.back_off = this.back_off * 2;
        this.init_socket(key, secret, sub);
      }, 2000 * this.back_off);
    });

    this.socket.on("error", (err) => {
      this.open = false;

      this.log.error(
        "socket connection",
        `${err.name} [${err.message}], reconnecting in 2 seconds`
      );

      setTimeout(() => {
        this.back_off = this.back_off * 2;
        this.init_socket(key, secret, sub);
      }, 2000 * this.back_off);
    });

    this.socket.on("message", (data, bin) => {
      if (bin) {
        this.log.error("socket message", "received malformed message");
        return;
      }

      try {
        let parsed_message: { route: string; method: string; payload: any } =
          JSON.parse(data.toString());

        if (!this.routes.has(parsed_message.route)) {
          return;
        }

        if (!this.routes.get(parsed_message.route).has(parsed_message.method)) {
          return;
        }

        console.dir(
          this.routes.get(parsed_message.route).get(parsed_message.method)
        );

        this.routes
          .get(parsed_message.route)
          .get(parsed_message.method)
          .default.execute(this.socket, parsed_message.payload, this.client);
      } catch (error) {
        this.log.error("socket message", error);
      }
    });
  }

  publish(action: string, route: string, method: string, payload: object) {
    if (!this.open || this.socket.readyState !== WebSocket.OPEN) {
      this.log.error("socket connection", "socket not connected");
      return;
    }

    this.socket.send(JSON.stringify({ action, route, method, payload }));
  }
}
