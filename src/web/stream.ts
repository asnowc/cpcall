/// <reference lib="dom"/>

import { CpCall } from "cpcall";
async function* iterReadable(readable: ReadableStream<Uint8Array>) {
  const reader = readable.getReader();
  let chunk = await reader.read();
  while (!chunk.done) {
    yield chunk.value;
    chunk = await reader.read();
  }
}
const voidFn = () => {};
/** @public */
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
