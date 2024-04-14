/// <reference lib="dom"/>

import { CpCall } from "cpcall";
async function* iterReadable(reader: ReadableStreamDefaultReader<Uint8Array>) {
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
  const reader = stream.readable.getReader();
  const config = {
    reader,
    writer: stream.writable.getWriter(),
    frameIter: iterReadable(reader),
    sendFrame(frame: Uint8Array) {
      this.writer.write(frame).catch(voidFn);
    },
    dispose() {
      this.reader.cancel();
    },
  } as const;
  return CpCall.fromByteIterable(config);
}
