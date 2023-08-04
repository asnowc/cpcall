export enum FrameType {
    call = 1,
    ignoreReturnCall = 2,

    changeReactionServer = 3,
    changeReactionAgent = 4,
    reactionServerCancel = 5, //delete id
    reactionAgentCancel = 6, //delete id
    actionResponse = 7,

    returnAsync = 8,
    resolve = 9,
    reject = 10,

    return = 11,
    throw = 12,

    streamFrame = 0b1_01000,

    /** 收到fin后表示对方不会再发起调用 */
    fin = 0b1111_1110,
}

export class CpcUnknownFrameTypeError extends Error {
    constructor(frameType: any) {
        super(`Unknown frame type: ${frameType}`);
    }
}
