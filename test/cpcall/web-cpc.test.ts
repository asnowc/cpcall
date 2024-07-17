import { createWebStreamCpc } from "cpcall";
import { expect, test, vi } from "vitest";
import {
  ReadableStream,
  UnderlyingSource,
  ReadableStreamDefaultController,
  WritableStream,
  UnderlyingSink,
  WritableStreamDefaultController,
} from "node:stream/web";

test("readable异常", async function () {
  const { writable, readable, readableCtrl, writableCtrl } = createMockStream();
  const cpc = createWebStreamCpc({ readable, writable });
  const err = new Error("ReadableStream error");
  readableCtrl.controller.error(err);
  await expect(cpc.onClose).rejects.toThrowError(err);
}, 500);
test("writable异常", async function () {
  const { writable, readable, readableCtrl, writableCtrl } = createMockStream();
  const cpc = createWebStreamCpc({ readable, writable });
  const err = new Error("WritableStream error");
  writableCtrl.controller.error(err);
  cpc.exec("hh");
  await expect(cpc.onClose).rejects.toThrowError(err);
}, 500);

function createMockStream() {
  const writableCtrl = new WritableSource();
  const readableCtrl = new ReadableSource();
  return {
    writableCtrl,
    readableCtrl,
    readable: new ReadableStream<Uint8Array>(readableCtrl),
    writable: new WritableStream<Uint8Array>(writableCtrl),
  };
}
class ReadableSource implements UnderlyingSource<Uint8Array> {
  cancel = vi.fn();

  controller!: ReadableStreamDefaultController<Uint8Array>;
  start(controller: ReadableStreamDefaultController) {
    this.controller = controller;
  }
}

class WritableSource implements UnderlyingSink<Uint8Array> {
  controller!: WritableStreamDefaultController;
  start(this: WritableSource, controller: WritableStreamDefaultController) {
    this.controller = controller;
  }
  abort = vi.fn();
  close = vi.fn();
}
