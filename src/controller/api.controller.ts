/**
 * Copyright 2021 TM9657 GmbH. All Rights Reserved.
 *
 * API Interface to our Backend. Currently not in use,
 * could change later on.
 */

import got, { Options } from "got";
import ClientController from "./client.controller.js";

export default class APIController {
  private client: ClientController = null;
  private options: Options = new Options();
  constructor(client: ClientController) {
    this.client = client;
  }

  async init() {
    this.options = new Options({
      prefixUrl: this.client.config().API_ROUTE,
      http2: true,
      headers: {
        Authorization: JSON.stringify({
          sub: this.client.config().USER,
          key: this.client.config().API,
          secret: this.client.config().SECRET,
        }),
      },
    });
  }

  async request(
    method: "GET" | "POST",
    request_path: string,
    body?: object
  ): Promise<{ success: boolean; data?: any }> {
    try {
      if (method === "POST") {
        this.options.body = "";
        if (typeof body !== "undefined") {
          this.options.body = JSON.stringify(body);
        }

        //@ts-ignore TODO: when using the api, check if the error has been solved. I did not experience it the first few times, but suddenly get a property does not exist ts error
        const { success, message } = await got
          .post(request_path, {
            ...this.options,
            json: body,
          })
          .json();

        return { success: success, data: message };
      }

      //@ts-ignore TODO: when using the api, check if the error has been solved. I did not experience it the first few times, but suddenly get a property does not exist ts error
      const { success, message } = await got
        .get(request_path, {
          ...this.options,
        })
        .json();
      return { success: success, data: message };
    } catch (error) {
      console.log(error);
      return { success: false };
    }
  }
}
