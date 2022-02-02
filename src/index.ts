/**
 * Copyright 2021 TM9657 GmbH. All Rights Reserved.
 *
 * Initiating the client Controller
 */

import ClientController from "./controller/client.controller.js";
import config from "./config/config.js";
import "dotenv/config";

const client = new ClientController(config);
