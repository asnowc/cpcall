export abstract class ByteParser<T> {
  abstract next(chunk: Uint8Array): boolean;
  protected result?: { value: T; residue?: Uint8Array };

  end() {
    const result = this.result;
    if (!result) throw new Error("unfinished");
    this.result = undefined;
    return result;
  }
}
export class LengthByteParser extends ByteParser<Uint8Array> {
  constructor(readonly total: number) {
    super();
    if (total <= 0) throw new Error("total must gt 0");
    this.length = total;
  }
  private length: number;
  private list: Uint8Array[] = [];
  next(buf: Uint8Array): boolean {
    if (buf.byteLength > this.length) {
      const residue = buf.subarray(this.length);
      this.list.push(buf.subarray(0, this.length));
      this.result = { value: this.endValue(), residue };
      return true;
    } else if (buf.length === this.length) {
      this.list.push(buf);
      this.result = { value: this.endValue() };
      return true;
    }
    this.list.push(buf);
    return false;
  }
  private endValue(): Uint8Array {
    let buf: Uint8Array;
    if (this.list.length === 1) buf = this.list[0];
    else {
      buf = new Uint8Array(this.total);
      let offset = 0;
      for (let i = 0; i < this.list.length; i++) {
        buf.set(this.list[i], offset);
        offset += this.list[i].byteLength;
      }
    }
    this.list.length = 0;
    this.length = this.total;
    return buf;
  }
}

export class StepsParser<T> extends ByteParser<T> {
  constructor(
    opts: { first: ByteParser<any>; final?: (data: any) => T },
    ...steps: ((data: any) => ByteParser<any>)[]
  ) {
    super();
    this.first = opts.first;
    this.current = opts.first;
    this.final = opts.final;
    this.steps = steps;
  }
  private current: ByteParser<any>;
  private first: ByteParser<any>;
  private final?: (data: any) => T;
  private steps: ((data: any) => ByteParser<any>)[];
  step = 0;
  next(chunk: Uint8Array): boolean {
    if (this.current.next(chunk)) {
      const res = this.current.end();
      let next = this.steps[this.step++];
      if (next) {
        this.current = next(res.value);
        if (res.residue) return this.next(res.residue);
        return false;
      }
      this.result = { value: this.final ? this.final(res.value) : res.value, residue: res.residue };
      this.step = 0;
      this.current = this.first;
      return true;
    }
    return false;
  }
}
