import { ObjectId } from "#rt/common/js_bson.js";
type BaseType = string | number | boolean | bigint | null | undefined | object;
type AdvType = [type: number, value: any];
type RawData = BaseType | AdvType;
enum AdvDataType {
    array = 0,
    objectId = 1,
    reaction = 2,

    regExp = 10,
    error = 11,
    arrayBuffer = 12,
    buffer = 13,
}

export class Trans {
    /** advSerialization 是否已启用高级序列号 */
    constructor(readonly advSerialization?: boolean) {}
    private readAdvValue(type: number, raw: any): any {
        switch (type) {
            case AdvDataType.array:
                return this.readArray(raw);
            case AdvDataType.objectId:
                return new ObjectId(raw);
            case AdvDataType.buffer:
                return Buffer.from(raw, "ascii");
            case AdvDataType.regExp:
                return new RegExp(raw);
            case AdvDataType.error:
                let err = new Error(raw.message, { cause: raw.cause });
                if (raw.name) err.name = raw.name;
                return err;
            case AdvDataType.arrayBuffer:
                const arrayBuffer = new ArrayBuffer(raw.length);
                Buffer.from(arrayBuffer).write(raw, "ascii");
                return arrayBuffer;

            default:
                throw new Error("unsor");
        }
    }
    private writeAdvValue(value: any) {
        if (Array.isArray(value)) return [AdvDataType.array, this.writeArray(value)];
        else if (value instanceof ObjectId) return [AdvDataType.objectId, value.value];
        else if (!this.advSerialization) {
            if (value instanceof Buffer) {
                return [AdvDataType.buffer, value.toString("ascii")];
            } else if (value instanceof ArrayBuffer) {
                return [AdvDataType.arrayBuffer, Buffer.from(value).toString("ascii")];
            } else if (value instanceof Error) {
                const { message, name, cause } = value;
                return [AdvDataType.error, { message, name, cause }];
            } else if (value instanceof RegExp) {
                return [AdvDataType.regExp, value.source];
            }
        }
        return this.writeMap(value);
    }

    writeArray(array: any[]) {
        const data: RawData[] = [];
        for (let i = 0; i < array.length; i++) {
            data[i] = this.writeValue(array[i]);
        }
        return data;
    }
    writeMap(rawMap: object) {
        const map: Record<string, RawData> = {};
        const array = Object.entries(rawMap);
        for (let i = 0; i < array.length; i++) {
            const [key, value] = array[i];
            map[key] = this.writeValue(value);
        }
        return map;
    }
    readMap(map: Record<string, RawData>) {
        for (const [key, value] of Object.entries(map)) {
            if (Array.isArray(value)) {
                map[key] = this.readAdvValue(value[0], value[1]);
            } else if (typeof value === "object" && value) {
                map[key] = this.readMap(value as any);
            }
        }
        return map;
    }
    readArray(array: RawData[]) {
        if (!Array.isArray(array)) throw new Error("传入参数不是Array");
        for (let i = 0; i < array.length; i++) {
            const value = array[i];
            if (Array.isArray(value)) {
                array[i] = this.readAdvValue(value[0], value[1]);
            } else if (typeof value === "object" && value) {
                array[i] = this.readMap(value as any);
            }
        }
        return array;
    }

    writeValue(value: any): RawData {
        if (typeof value === "object" && value) {
            return this.writeAdvValue(value);
        }
        return value;
    }
    readValue(data: any) {
        if (Array.isArray(data)) {
            return this.readAdvValue(data[0], data[1]);
        } else if (typeof data === "object" && data) {
            return this.readMap(data as any);
        }
        return data;
    }
    readReturn(data: any) {
        return this.readValue(data)
        return data;
    }
    writeReturn(data: any) {
       return this.writeValue(data);
    }
}
