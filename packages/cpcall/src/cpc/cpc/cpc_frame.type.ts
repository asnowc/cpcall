/** @public */
export enum FrameType {
    call = 1,
    exec = 2,
    actionResponse = 7,

    returnAsync = 8,
    resolve = 9,
    reject = 10,

    return = 11,
    throw = 12,

    /** 收到fin后表示对方不会再发起调用 */
    fin = 0b1111_1110,
}
/** @public */
export type CpcEvents = {
    end: [];
    close: [error?: Error];
    error: [error: Error];
};
/**  @public  */
export type CpcCmdList = {
    [key: string | number]: (...args: any[]) => any;
};
/**  @public  */
export class CpcError extends Error {}

/**
 * @public
 * @remarks 调用失败异常
 */
export class CpcCallError extends Error {
    constructor(msg: string = "Call failed") {
        super(msg);
    }
}
/**
 * @public
 * @remarks 在返回前断开连接
 */
export class CpcFailRespondError extends CpcCallError {
    constructor() {
        super("CpcFailRespondError");
    }
}
/**  @public 已返回 AsyncId (命令已被执行), 但Promise状态在变化前断开连接*/
export class CpcFailAsyncRespondError extends CpcFailRespondError {}
/**  @public 调用未注册的命令 */
export class CpcUnregisteredCommandError extends CpcCallError {
    constructor() {
        super("CpcUnregisteredCommandError");
    }
}
/**  @public  */
export class CpcUnknownFrameTypeError extends Error {
    constructor(frameType: any) {
        super(`Unknown frame type: ${frameType}`);
    }
}
