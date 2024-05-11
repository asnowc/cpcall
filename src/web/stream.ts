import { CpCall } from "cpcall";
async function* iterReadable(readable: SameReadableStream) {
  const reader = readable.getReader();
  let chunk = await reader.read();
  while (!chunk.done) {
    yield chunk.value;
    chunk = await reader.read();
  }
}
const voidFn = () => {};
/**
 * @public
 * @remarks 创建一个基于 WebStream 的 CpCall 实例。这可以是 Deno.Conn 对象
 */
export function createWebStreamCpc(stream: {
  readable: ReadableStream<Uint8Array>;
  writable: WritableStream<Uint8Array>;
}) {
  const config = {
    readable: stream.readable,
    writer: stream.writable.getWriter(),
    frameIter: iterReadable(stream.readable),
    sendFrame(frame: Uint8Array) {
      this.writer.write(frame).catch(voidFn);
    },
    close() {
      return this.writer.close();
    },
    dispose(reason: any) {
      return this.readable.cancel(reason);
    },
  } as const;
  return CpCall.fromByteIterable(config);
}

// ReadableStream 最小依赖
interface ReadableStream<T> {
  getReader(): {
    read(): Promise<SameReadableStreamReadResult<T>>;
  };
  cancel(reason?: any): void;
}
type SameReadableStreamReadResult<T> = { done: true } | { done?: false; value: T };

// WritableStream 最小依赖
interface WritableStream<T> {
  getWriter(): {
    close(): Promise<void>;
    write(data: T): Promise<void>;
  };
}
type SameReadableStream = ReadableStream<Uint8Array>;
