export abstract class ByteParser<T> implements BySteps<T> {
  abstract next(chunk: Uint8Array): boolean;
  protected result?: ParserResult<T>;
  finish(): ParserResult<T> {
    const result = this.result;
    if (!result) throw new Error("unfinished");
    this.result = undefined;
    return result;
  }
}
type ParserResult<T> = { value: T; residue?: Uint8Array };
interface BySteps<T> {
  next(chunk: Uint8Array): boolean;
  finish(): ParserResult<T>;
}
