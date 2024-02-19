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
  const writer = stream.writable.getWriter();
  return CpCall.fromByteIterable(iterReadable(stream.readable), (frame) => {
    writer.write(frame).catch(voidFn);
  });
}
