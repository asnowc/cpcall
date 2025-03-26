import { createWebSocketCpc } from "cpcall";
import { vi, test, expect } from "vitest";

test("可以使用 WebSocket 进行双向远程调用", async function () {
  const { ws1, ws2 } = createConnectedWs();
  const cpc1 = createWebSocketCpc(ws1);
  const cpc2 = createWebSocketCpc(ws2);

  const fn = vi.fn((arg) => arg);
  cpc2.exposeObject({ abc: fn });
  const cal = cpc1;
  const res = await Promise.all([cal.call("abc", 1), cal.call("abc", 3)]);
  expect(res).toEqual([1, 3]);
});
test("WebSocket 实例如果不是 OPEN 状态将抛出异常", function () {
  const ws = new MockWebSocket();
  ws.readyState = 0;
  expect(() => createWebSocketCpc(ws), "websocket状态必须为已连接").toThrowError();
});

type WS = Parameters<typeof createWebSocketCpc>[0];

class MockWebSocket extends EventTarget implements WS {
  constructor() {
    super();
  }
  readonly CONNECTING: number = 0;
  readonly OPEN = 1;
  binaryType = "ArrayBuffer";
  send: (data: Uint8Array) => void = vi.fn();
  close: () => void = vi.fn();
  readyState = this.OPEN;
}
interface MockWebSocket extends EventTarget {
  addEventListener(name: "message", fn: (e: { readonly data: any }) => void): void;
  addEventListener(name: string, fn: (e: Event) => void): void;
}

/** 模拟一对已经连接的 WebSocket */
function createConnectedWs() {
  const ws1 = new MockWebSocket();
  const ws2 = new MockWebSocket();
  function send(ws: MockWebSocket, frame: any) {
    const event = new Event("message") as Event & { data: ArrayBufferLike | string };
    let buf: ArrayBufferLike | string;
    if (frame instanceof Uint8Array) {
      if (frame.buffer.byteLength === frame.byteLength) buf = frame.buffer;
      else {
        const u8Arr = new Uint8Array(frame);
        buf = u8Arr.buffer;
      }
    } else buf = String(frame);
    event.data = buf;

    ws.dispatchEvent(event);
  }

  ws1.send = (frame) => send(ws2, frame);
  ws1.close = function () {
    this.dispatchEvent(new Event("close"));
    ws2.dispatchEvent(new Event("close"));
  };

  ws2.send = (frame) => send(ws1, frame);
  ws2.close = function () {
    this.dispatchEvent(new Event("close"));
    ws1.dispatchEvent(new Event("close"));
  };
  return { ws1, ws2 };
}
