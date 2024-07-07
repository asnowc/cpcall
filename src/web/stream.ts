import { CpCall, CpcController, CpcFrameSource } from "cpcall";

/** 创建一个基于 WebStream 的 CpCall 实例。这可以是 Deno.Conn 对象
 * @public
 */
export function createWebStreamCpc(stream: WebStreamSuite) {
  return CpCall.fromJbodFrameSource(new WebStreamSource(stream));
}
class WebStreamSource implements CpcFrameSource<Uint8Array> {
  constructor(stream: WebStreamSuite) {
    this._reader = stream.readable.getReader();
    this._writer = stream.writable.getWriter();
    this._reader.closed.then(
      () => (this.readerClosed = true),
      () => (this.readerClosed = true)
    );
    this._writer.closed.then(
      () => (this.writerClosed = true),
      () => (this.writerClosed = true)
    );
  }
  private _reader;
  private _writer;
  private writerClosed = false;
  private readerClosed = false;
  private onWriterError = (e: any) => {
    this.writerClosed = true;
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
    if (!this.writerClosed) return this._writer.close();
  }
  dispose(reason?: any) {
    if (!this.readerClosed) this._reader.cancel(reason);
    if (!this.writerClosed) return this._writer.close();
  }
  sendFrame(frame: Uint8Array): void {
    this._writer.write(frame).catch(this.onWriterError);
  }
}
/** @public */
export type WebStreamSuite = {
  readable: ReadableStream<Uint8Array>;
  writable: WritableStream<Uint8Array>;
};

// ReadableStream 最小依赖
interface ReadableStream<T> {
  getReader(): {
    read(): Promise<SameReadableStreamReadResult<T>>;
    closed: Promise<void>;
    cancel(reason?: any): void;
  };
}
type SameReadableStreamReadResult<T> = { done: true } | { done?: false; value: T };

// WritableStream 最小依赖
interface WritableStream<T> {
  getWriter(): {
    write(data: T): Promise<void>;
    close(): Promise<void>;
    closed: Promise<void>;
  };
}
