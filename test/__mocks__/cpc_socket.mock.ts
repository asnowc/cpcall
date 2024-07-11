import { Duplex, Readable } from "node:stream";
import { createSocketCpc } from "cpcall";
import { vi } from "vitest";
import { CpCall } from "cpcall";
import EventEmitter from "node:events";
import { CalleeCore } from "../../src/cpc/core/mod.ts";
/** 模拟两个已建立连接的 Socket, 并初始化监听他们的  close 事件 */
export function getNoResponseCpc() {
  return new CpCall({ init(controller) {}, sendFrame: () => {}, close() {}, dispose() {} });
}
export type InternalCpcall = CpCall & {
  name: string;
  responsePromiseNum: number;
};
/** 模拟两个已连接的 CpcSocket */
export function createConnectedCpc(clientFn?: object, serverFn?: object) {
  const { clientSocket, serverSocket } = createConnectedSocket();
  const serverCpc = createSocketCpc(serverSocket) as InternalCpcall;
  const clientCpc = createSocketCpc(clientSocket) as InternalCpcall;

  if (clientFn) clientCpc.setObject(clientFn);
  if (serverFn) serverCpc.setObject(serverFn);
  clientCpc.name = "client";
  serverCpc.name = "server";

  return { serverCpc, clientCpc, serverSocket, clientSocket };
}
export function setDuplexEvents(duplex: EventEmitter) {
  const listeners = {
    onFinish: vi.fn(),
    onEnd: vi.fn(),
    onClose: vi.fn(),
    onError: vi.fn(),
  };
  duplex.on("close", listeners.onClose);
  duplex.on("end", listeners.onEnd);
  duplex.on("error", listeners.onError);
  duplex.on("finish", listeners.onFinish);
  return listeners;
}
/** 模拟两个已建立连接的 Socket */
export function createConnectedSocket() {
  const serverSocket = new Duplex({
    write(chunk, encoding, callback) {
      clientSocket.push(chunk, encoding);
      callback();
    },
    read(size) {},
    final(callback) {
      clientSocket.push(null);
      callback();
    },
    destroy(error, callback) {
      if (!clientSocket.destroyed) clientSocket.destroy(error as Error | undefined);
      callback(error);
    },
  });
  const clientSocket = new Duplex({
    write(chunk, encoding, callback) {
      serverSocket.push(chunk, encoding);
      callback();
    },
    read(size) {},
    final(callback) {
      serverSocket.push(null);
      callback();
    },
    destroy(error, callback) {
      if (!serverSocket.destroyed) serverSocket.destroy(error as Error | undefined);
      callback(error);
    },
  });
  (serverSocket as any).name = "server-sockect";
  (clientSocket as any).name = "client-sockect";
  return { serverSocket, clientSocket };
}
export function createIter() {}
/**
 * @param sp 以字节为单位分隔
 */
export function bufToHex(buf: Buffer, sp?: number[]) {
  let hex = buf.toString("hex");
  return hexFormat(
    hex,
    sp?.map((byte) => byte * 2)
  );
}
/**
 * @param sp 以长度为单位分隔
 */
export function hexFormat(hex: string, sp?: number[]) {
  let format = "";
  if (sp) {
    let max = sp.length - 1;
    for (let i = 0; i < max; i++) {
      let len = sp[i];
      if (hex.length > len) {
        format += hex.slice(0, len) + " ";
        hex = hex.slice(len);
      } else {
        format += hex;
        return format;
      }
    }
    format += hex;
    return format;
  } else {
    while (hex.length > 4) {
      format += hex.slice(0, 4);
      hex = hex.slice(4);
      if (hex.length) format += " ";
      else break;
    }
    return (format += hex);
  }
}

export function getReadable() {
  return new Readable({ read(size) {} });
}
