// const fs = require('fs-extra');
// const os = require('os');
// const parallel = require('run-parallel');
// const path = require('path');
// const queueMicrotask = require('queue-microtask');
// const raf = require('random-access-file');
// const rimraf = require('rimraf');
// const thunky = require('thunky');
import fs from "fs-extra";
import os from "os";
import parallel from "run-parallel";
import path from "path";
import queueMicrotask from "queue-microtask";
import rimraf from "rimraf";
import thunky from "thunky";
import crypto from "crypto";
//@ts-ignore
import raf from "random-access-file";
export class CA9Store {
  private chunkLength = 0;
  private name = "";
  private addUID = false;
  private path = "";
  private files: any[] = [];
  private length = 0;
  private closed = false;
  private chunkMap: any[] = [];
  private lastChunkLength = 0;
  private lastChunkIndex = 0;

  // you should always provide an instance of a global FileHandleManager. Otherwise the optimization is per torrent and you run into
  // problems with many torrents running.
  private fileHandleManager: ResourceManager = null;

  constructor(
    chunkLength: number,
    opts: {
      files?: { path: string; length: number };
      path?: string;
      addUID?: boolean;
      name?: string;
      length?: number;
      resourceManager?: ResourceManager;
    }
  ) {
    const self = this;
    let TMP;
    try {
      TMP = fs.statSync("/tmp") && "/tmp";
    } catch (err) {
      TMP = os.tmpdir();
    }
    if (!opts) opts = {};

    self.chunkLength = Number(chunkLength);
    if (!self.chunkLength)
      throw new Error("First argument must be a chunk length");
    self.name =
      opts.name ||
      path.join("fs-chunk-store", crypto.randomBytes(20).toString("hex"));
    self.addUID = opts.addUID;

    //! Please always provide one..
    this.fileHandleManager =
      opts.resourceManager ?? new ResourceManager(10, 60);

    if (opts.files) {
      self.path = opts.path;
      if (!Array.isArray(opts.files)) {
        throw new Error("`files` option must be an array");
      }
      self.files = opts.files.slice(0).map(function (file, i, files) {
        if (file.path == null)
          throw new Error("File is missing `path` property");
        if (file.length == null)
          throw new Error("File is missing `length` property");
        if (file.offset == null) {
          if (i === 0) {
            file.offset = 0;
          } else {
            const prevFile = files[i - 1];
            file.offset = prevFile.offset + prevFile.length;
          }
        }
        if (self.path) {
          file.path = self.addUID
            ? path.resolve(path.join(self.path, self.name, file.path))
            : path.resolve(path.join(self.path, file.path));
        }
        return file;
      });
      self.length = self.files.reduce(function (sum, file) {
        return sum + file.length;
      }, 0);
      if (opts.length != null && opts.length !== self.length) {
        throw new Error(
          "total `files` length is not equal to explicit `length` option"
        );
      }
    } else {
      const len = Number(opts.length) || Infinity;
      self.files = [
        {
          offset: 0,
          path: path.resolve(opts.path || path.join(TMP, self.name)),
          length: len,
        },
      ];
      self.length = len;
    }

    self.chunkMap = [];
    self.closed = false;

    self.files.forEach(function (file) {
      file.open = (cb: (arg0: Error, arg1?: any) => void) => {
        if (self.closed) return cb(new Error("Storage is closed"));
        try {
          fs.mkdirSync(path.dirname(file.path), { recursive: true });
        } catch (error) {}
        if (self.closed) return cb(new Error("Storage is closed"));
        cb(null, self.fileHandleManager.request(self.name, file.path));
      };
    });

    // If the length is Infinity (i.e. a length was not specified) then the store will
    // automatically grow.

    if (self.length !== Infinity) {
      self.lastChunkLength = self.length % self.chunkLength || self.chunkLength;
      self.lastChunkIndex = Math.ceil(self.length / self.chunkLength) - 1;

      self.files.forEach(function (file) {
        const fileStart = file.offset;
        const fileEnd = file.offset + file.length;

        const firstChunk = Math.floor(fileStart / self.chunkLength);
        const lastChunk = Math.floor((fileEnd - 1) / self.chunkLength);

        for (let p = firstChunk; p <= lastChunk; ++p) {
          const chunkStart = p * self.chunkLength;
          const chunkEnd = chunkStart + self.chunkLength;

          const from = fileStart < chunkStart ? 0 : fileStart - chunkStart;
          const to =
            fileEnd > chunkEnd ? self.chunkLength : fileEnd - chunkStart;
          const offset = fileStart > chunkStart ? 0 : chunkStart - fileStart;

          if (!self.chunkMap[p]) self.chunkMap[p] = [];

          self.chunkMap[p].push({
            from,
            to,
            offset,
            file,
          });
        }
      });
    }
  }

  put(index: any, buf: any, cb: any) {
    const self = this;
    if (typeof cb !== "function") cb = noop;
    if (self.closed) return nextTick(cb, new Error("Storage is closed"));

    const isLastChunk = index === self.lastChunkIndex;
    if (isLastChunk && buf.length !== self.lastChunkLength) {
      return nextTick(
        cb,
        new Error("Last chunk length must be " + self.lastChunkLength)
      );
    }
    if (!isLastChunk && buf.length !== self.chunkLength) {
      return nextTick(
        cb,
        new Error("Chunk length must be " + self.chunkLength)
      );
    }

    if (self.length === Infinity) {
      self.files[0].open(function (
        err: any,
        file: { write: (arg0: number, arg1: any, arg2: any) => void }
      ) {
        if (err) return cb(err);
        file.write(index * self.chunkLength, buf, cb);
      });
    } else {
      const targets = self.chunkMap[index];
      if (!targets)
        return nextTick(cb, new Error("no files matching the request range"));
      const tasks = targets.map(function (target: {
        file: { open: (arg0: (err: any, file: any) => any) => void };
        offset: any;
        from: any;
        to: any;
      }) {
        return function (cb: (arg0: any) => any) {
          target.file.open(function (
            err: any,
            file: { write: (arg0: any, arg1: any, arg2: any) => void }
          ) {
            if (err) return cb(err);
            file.write(target.offset, buf.slice(target.from, target.to), cb);
          });
        };
      });
      parallel(tasks, cb);
    }
  }

  get(index: any, opts: any, cb: any): any {
    const self = this;
    if (typeof opts === "function") return self.get(index, null, opts);
    if (self.closed) return nextTick(cb, new Error("Storage is closed"));

    const chunkLength =
      index === self.lastChunkIndex ? self.lastChunkLength : self.chunkLength;

    const rangeFrom = (opts && opts.offset) || 0;
    const rangeTo = opts && opts.length ? rangeFrom + opts.length : chunkLength;

    if (rangeFrom < 0 || rangeFrom < 0 || rangeTo > chunkLength) {
      return nextTick(cb, new Error("Invalid offset and/or length"));
    }

    if (self.length === Infinity) {
      //@ts-ignore
      if (rangeFrom === rangeTo) return nextTick(cb, null, Buffer.from(0));
      self.files[0].open(function (
        err: any,
        file: { read: (arg0: any, arg1: number, arg2: any) => void }
      ) {
        if (err) return cb(err);
        const offset = index * self.chunkLength + rangeFrom;
        file.read(offset, rangeTo - rangeFrom, cb);
      });
    } else {
      let targets = self.chunkMap[index];
      if (!targets)
        return nextTick(cb, new Error("no files matching the request range"));
      if (opts) {
        targets = targets.filter(function (target: {
          to: number;
          from: number;
        }) {
          return target.to > rangeFrom && target.from < rangeTo;
        });
        if (targets.length === 0) {
          return nextTick(
            cb,
            new Error("no files matching the requested range")
          );
        }
      }
      //@ts-ignore
      if (rangeFrom === rangeTo) return nextTick(cb, null, Buffer.from(0));

      const tasks = targets.map(function (target: {
        from: any;
        to: any;
        offset: any;
        file: { open: (arg0: (err: any, file: any) => any) => void };
      }) {
        return function (cb: (arg0: any) => any) {
          let from = target.from;
          let to = target.to;
          let offset = target.offset;

          if (opts) {
            if (to > rangeTo) to = rangeTo;
            if (from < rangeFrom) {
              offset += rangeFrom - from;
              from = rangeFrom;
            }
          }

          target.file.open(function (
            err: any,
            file: { read: (arg0: any, arg1: number, arg2: any) => void }
          ) {
            if (err) return cb(err);
            file.read(offset, to - from, cb);
          });
        };
      });

      parallel(tasks, function (err: any, buffers: readonly Uint8Array[]) {
        if (err) return cb(err);
        cb(null, Buffer.concat(buffers));
      });
    }
  }

  close(cb: any) {
    const self = this;
    if (self.closed) return nextTick(cb, new Error("Storage is closed"));
    self.closed = true;

    const tasks = self.files.map(function (file) {
      return function (cb: (arg0: any) => any) {
        file.open(function (err: any, file: { close: (arg0: any) => void }) {
          // an open error is okay because that means the file is not open
          if (err) return cb(null);
          file.close(cb);
        });
      };
    });
    parallel(tasks, cb);
  }

  destroy(cb: any) {
    const self = this;
    self.close(function () {
      if (self.addUID && self.path) {
        rimraf(
          path.resolve(path.join(self.path, self.name)),
          { maxBusyTries: 10 },
          cb
        );
      } else {
        const tasks = self.files.map(function (file) {
          return function (cb: any) {
            rimraf(file.path, { maxBusyTries: 10 }, cb);
          };
        });
        parallel(tasks, cb);
      }
    });
  }
}

function nextTick(cb: (arg0?: any, arg1?: any) => void, err?: any, val?: any) {
  queueMicrotask(function () {
    if (cb) cb(err, val);
  });
}

function noop() {}

export class ResourceManager {
  private size = 0;
  private interval = 0;

  // t: ttl, h: handle
  private handles: Map<string, { t: number; h: any }> = new Map();

  constructor(size: number = 500, interval: number = 10) {
    this.size = size;
    this.interval = interval * 1000;
    this.cleanup();
  }

  request(hash: string, file: string) {
    let key = hash + file;

    if (this.handles.has(key)) {
      let handle = this.handles.get(key);
      handle.t = Date.now() + 1000 * 60 * 10;
      this.handles.delete(key);
      this.handles.set(key, handle);
      return handle.h;
    }

    if (this.handles.size > this.size) {
      let [first] = this.handles.entries();
      first[1].h.close();
      this.handles.delete(first[0]);
    }

    let handle = raf(file);
    this.handles.set(key, {
      t: Date.now() + 1000 * 60 * 10,
      h: handle,
    });
    return handle;
  }

  private cleanup() {
    //! sometimes killing in use handles
    // this.handles.forEach((value, key) => {
    //   if (value.t < Date.now()) {
    //     value.h.close();
    //     this.handles.delete(key);
    //   }
    // });

    setTimeout(() => {
      this.cleanup();
    }, this.interval);
  }
}
