/**
 * Copyright 2021 TM9657 GmbH. All Rights Reserved.
 *
 * Contains Log Information that the user can access
 * via Websocket.
 */

import chunk from "lodash/chunk.js";

export default class LogController {
  private timing: Map<string, number> = new Map();
  private logs: Map<string, { topic: string; content: string }> = new Map();
  uptime = Date.now();

  constructor() {}

  log(topic: string, content: string) {
    console.log(
      `[INFO][${topic.toUpperCase()}] (${new Date(
        Date.now()
      ).toString()}) :: \n~~ ${content} ~~`
    );
    this.logs.set(`log#${Date.now()}`, { content, topic });
    this.check()
  }

  warn(topic: string, content: string) {
    console.log(
      `[WARNING][${topic.toUpperCase()}] (${new Date(
        Date.now()
      ).toString()}) :: \n~~ ${content} ~~`
    );
    this.logs.set(`warn#${Date.now()}`, { content, topic });
    this.check()
  }

  error(topic: string, content: string) {
    console.log(
      `[ERROR][${topic.toUpperCase()}] (${new Date(
        Date.now()
      ).toString()}) :: \n~~ ${content} ~~`
    );
    this.logs.set(`err#${Date.now()}`, { content, topic });
    this.check()
  }

  time(topic: string, label: string) {
    if (this.timing.has(label)) {
      console.log(
        `[TIMING][${topic.toUpperCase()}] (${new Date(
          Date.now()
        ).toString()}) :: \n~~ ${label}: ${(
          Date.now() - this.timing.get(label)
        ).toFixed(2)} ms ~~`
      );
      this.logs.set(`time#${Date.now()}`, {
        content: `${label}: ${(
          Date.now() - this.timing.get(label)
        ).toFixed(2)} ms`,
        topic,
      });
      this.timing.delete(label);
      this.check()
    } else {
      this.timing.set(label, Date.now());
    }
  }

  get(
    filter: "all" | "info" | "warn" | "error" | "time" = "all",
    page: number = 0
  ) {

    let logs_array = Array.from(this.logs).reverse();

    switch (filter) {
      case "all":
        break;
      case "warn":
        logs_array.filter((value) => {
          value[0].startsWith("warn");
        });
        break;
      case "info":
        logs_array.filter((value) => {
          value[0].startsWith("log");
        });
        break;
      case "error":
        logs_array.filter((value) => {
          value[0].startsWith("err");
        });
        break;
      case "time":
        logs_array.filter((value) => {
          value[0].startsWith("time");
        });
        break;
    }

    let paginated_log = chunk(logs_array, 25);

    if(paginated_log.length >= page + 1){
      return paginated_log[page].reverse();
    }

    return []
  }

  check(){
    if(this.logs.size <= 1000){
      return;
    }
    const [oldest] = this.logs.keys()
    this.logs.delete(oldest)
  }
}
