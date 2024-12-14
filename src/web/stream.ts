import { CpCall, CpCallOption, CpcController, CpcFrameSource, JbodStreamFrameSource } from "../cpc/mod.ts";

/** 创建一个基于 WebStream 的 CpCall 实例。这可以是 Deno.Conn 对象
 * @public
 * @category Rpc
 */
export function createWebStreamCpc(
  stream: {
    readable: PruneReadableStream<Uint8Array>;
    writable: PruneWritableStream<Uint8Array>;
  },
  option?: CpCallOption
): CpCall {
  const source = new JbodStreamFrameSource(new WebStreamSource(stream));
  return new CpCall(source, option);
}
class WebStreamSource implements CpcFrameSource<Uint8Array> {
  constructor(stream: WebStreamSuite) {
    this._reader = stream.readable.getReader();
    this._writer = stream.writable.getWriter();
    this._reader.closed.then(
      () => (this.readerClosed = true),
      () => (this.readerClosed = true)
    );
  }
  private _reader;
  private _writer;
  private readerClosed = false;
  private onWriterError = (e: any) => {
    if (!this.readerClosed) {
      this.readerClosed = true;
      this._reader.cancel(e);
      this.cpcController.endFrame(e);
    }
  };
  private cpcController!: CpcController<Uint8Array>;
  async init(controller: CpcController<Uint8Array>) {
    this.cpcController = controller;
    const reader = this._reader;
    try {
      let chunk = await reader.read();
      while (!chunk.done) {
        controller.nextFrame(chunk.value);
        chunk = await reader.read();
      }
      controller.endFrame(new Error("ReadableStream no more data"));
    } catch (error) {
      controller.endFrame(error);
    }
  }
  close(): void | Promise<void> {
    //理论上这里这个 this.readerClosed 必定为 true
    if (!this.readerClosed) this._reader.cancel(new Error("WebStreamSource internal error"));
    return this._writer.close(); // 这里 write 预期应该没有被 close()
  }
  dispose(reason?: any) {
    if (!this.readerClosed) this._reader.cancel(reason);
    return this._writer.close().catch(() => {}); // _writer 可能已关闭，但是 writer.closed 的 Promise 是异步的，所以无法及时订阅关闭事件
  }
  sendFrame(frame: Uint8Array): void {
    this._writer.write(frame).catch(this.onWriterError);
  }
}
type WebStreamSuite = Parameters<typeof createWebStreamCpc>[0];

// ReadableStream 最小依赖
interface PruneReadableStream<T> {
  getReader(): {
    read(): Promise<SameReadableStreamReadResult<T>>;
    closed: Promise<void>;
    cancel(reason?: any): void;
  };
}
type SameReadableStreamReadResult<T> = { done: true } | { done?: false; value: T };

// WritableStream 最小依赖
interface PruneWritableStream<T> {
  getWriter(): {
    write(data: T): Promise<void>;
    close(): Promise<void>;
    closed: Promise<void>;
  };
}
