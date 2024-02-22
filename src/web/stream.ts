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
  const writer = stream.writable.getWriter();
  return CpCall.fromByteIterable(
    iterReadable(reader),
    (frame) => {
      writer.write(frame).catch(voidFn);
    },
    () => reader.cancel()
  );
}
