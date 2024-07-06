import { createWebStreamCpc } from "cpcall/web";
import { expect, test, vi } from "vitest";

test("readable异常", async function () {
  const { writable, readable, readableCtrl, writableCtrl } = createMockStream();
  const cpc = createWebStreamCpc({ readable, writable });
  const errEvent = cpc.onClose.getPromise();
  const err = new Error("ReadableStream error");
  readableCtrl.controller.error(err);
  await expect(errEvent).rejects.toThrowError(err);
}, 500);
test("writable异常", async function () {
  const { writable, readable, readableCtrl, writableCtrl } = createMockStream();
  const cpc = createWebStreamCpc({ readable, writable });
  const errEvent = cpc.onClose.getPromise();
  const err = new Error("WritableStream error");
  writableCtrl.controller.error(err);
  cpc.caller.exec("hh");
  await expect(errEvent).rejects.toThrowError(err);
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
class ReadableSource implements UnderlyingDefaultSource<Uint8Array> {
  cancel = vi.fn();

  controller!: ReadableStreamDefaultController<Uint8Array>;
  start(controller: ReadableStreamDefaultController<Uint8Array>) {
    this.controller = controller;
  }
}

class WritableSource implements UnderlyingSink<Uint8Array> {
  controller!: WritableStreamDefaultController;
  start: UnderlyingSinkStartCallback = function (this: WritableSource, controller) {
    this.controller = controller;
  };
  abort = vi.fn();
  close = vi.fn();
}
