/**
 * 自动控制 key 的 Map
 * 双指针控制已使用的key的范围, 当双指针已满时, 会遍历扫描碎片空间
 */
export class UniqueKeyMap<T = any> extends Map<number, T> {
  constructor(readonly maxSize: number) {
    if (maxSize <= 0 || isNaN(maxSize) || maxSize === Infinity || typeof maxSize !== "number") {
      throw new NumericalRangeError();
    }
    super();
  }
  #startPointer = 0;
  #lastPointer = 0;
  #assignPointer = 0; //碎片遍历指针

  get freeSize(): number {
    return this.maxSize - this.size;
  }
  get freeRange(): number {
    if (this.#startPointer === this.#lastPointer) {
      return this.size === 0 ? this.maxSize : 0;
    }

    if (this.#startPointer < this.#lastPointer) {
      return this.maxSize - (this.#lastPointer - this.#startPointer);
    }
    return this.#startPointer - this.#lastPointer;
  }
  get startPointer(): number {
    return this.#startPointer;
  }
  get lastPointer(): number {
    return this.#lastPointer;
  }

  /** 申请一个未使用的key
   * @returns number 唯一key
   */
  allocKeySet(data: T, safe?: undefined | false): number;
  /** 申请一个未使用的key
   * @returns number 唯一key
   * @returns null key已满
   */
  allocKeySet(data: T, safe?: boolean): number | null;
  allocKeySet(data: T, safe?: boolean): number | null {
    let key = this.findFreePointer();
    if (key !== null) super.set(key, data);
    else if (safe) return key;
    else throw new KeyIsFullError();
    return key;
  }
  /** 获取并删除 */
  take(key: number): T | undefined {
    let data = this.get(key);
    this.delete(key);
    return data;
  }
  override delete(key: number): boolean {
    if (super.delete(key)) {
      if (key === this.#startPointer) {
        this.#startPointer = this.movePointerAdd(this.#startPointer);
      } else if (key === this.movePointerSub(this.#lastPointer)) {
        this.#lastPointer = key;
      }
      if (this.startPointer === this.#lastPointer) {
        this.#startPointer = 0;
        this.#lastPointer = 0;
        this.#lastPointer = 0;
      }
      return true;
    }
    return false;
  }
  /**
   * 只能设置已存在的key的值, 否则抱出异常
   */
  override set(key: number, data: T): this {
    if (super.has(key)) return super.set(key, data);
    throw new OutOfKeyRangeError();
  }
  /** 如果key存在, 则更新值并返回true, 否则不更新并返回false */
  update(key: number, data: T): boolean {
    if (!super.has(key)) return false;
    super.set(key, data);
    return true;
  }
  override clear() {
    super.clear();
    this.#startPointer = 0;
    this.#lastPointer = 0;
    this.#assignPointer = 0;
  }

  private movePointerSub(val: number) {
    if (val === 0) return this.maxSize - 1;
    return val - 1;
  }
  private movePointerAdd(val: number) {
    if (val === this.maxSize - 1) return 0;
    return val + 1;
  }
  /** 获取下一个key值, 并更新指针 */
  private findFreePointer() {
    let size = this.size;
    if (size >= this.maxSize) return null; //已满

    let currentPointer = this.#lastPointer;
    let nextPointer = currentPointer + 1;
    if (nextPointer === this.maxSize) nextPointer = 0;

    //首指针和尾指针相等有三种情况，分别是全空、全满、非全空
    if (size > 0 && currentPointer === this.#startPointer) {
      //非全空
      let i = this.#assignPointer;
      //空闲块已满
      while (super.has(i)) {
        if (++i === this.maxSize) i = 0;
      }
      this.#assignPointer = i + 1;
      return i;
    }
    this.#lastPointer = nextPointer;
    return currentPointer;
  }
}

class OutOfKeyRangeError extends Error {}
class KeyIsFullError extends Error {}

class NumericalRangeError extends RangeError {
  constructor(min?: number, max?: number, valueName = "numerical range") {
    const invalid = valueName + " exception";
    let msg = "";
    if (min === undefined && max !== undefined) {
      msg = `${invalid}: The ${valueName} cannot be greater than ${max}`;
    } else if (min !== undefined && max === undefined) {
      msg = `${invalid}: The ${valueName} cannot be smaller than ${min}`;
    } else if (min === undefined && max === undefined) msg = invalid;
    else msg = `The ${valueName} must be in [${min}, ${max}]`;
    super(msg);
  }
}
