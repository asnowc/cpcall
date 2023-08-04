import { baseDataTypes as callbackBaseArgs, objectDataTypes as callBackObjectArgs } from "./bson.cases.js";
import {
    Cpc,
    CpcFailAsyncRespondError,
    CpcFailRespondError,
    CpcUnregisteredCommandError,
    ReactionController,
    ReactionService,
} from "#rt/cpc.js";
import { describe, it, expect, vi, SpyInstance } from "vitest";
import { CpcMocks, nextMacaoTask } from "./cpc.mock.js";

export function createServerFnCase() {
    return {
        returnArg0: vi.fn((arg1) => arg1),
        asyncReturnArgs: vi.fn(async (...args: any[]) => {
            await new Promise((resolve) => setTimeout(resolve));
            return args;
        }),
        throwError: vi.fn(() => {
            throw new Error("yy");
        }),
        throwArg0: vi.fn((arg) => {
            throw arg;
        }),
        asyncThrowError: vi.fn(async () => {
            await new Promise((resolve) => setTimeout(resolve));
            throw new Error("yy");
        }),
        asyncThrowArg0: vi.fn(async (arg) => {
            await new Promise((resolve) => setTimeout(resolve));
            throw arg;
        }),
    };
}

export function cpc(mocks: CpcMocks) {
    return function cpcCase() {
        const { createConnectedFcp, getNoResponseCpc } = mocks;
        it("实例创建状态检测", function () {
            const { cpcClient } = createConnectedFcp();
            expect(cpcClient.getAllCmd(), "无命令监听").toEqual({});
            expect(cpcClient.isEnded, "未结束").toBeFalsy();
            expect(cpcClient.closed, "初始状态").toBeFalsy();
        });
        describe("参数调用", function () {
            function createBase() {
                const fn = vi.fn((arg1) => arg1);
                const { cpcClient, cpcServer } = createConnectedFcp(undefined, { fn });
                return { cpcClient, cpcServer, fn, cmd: "fn" };
            }

            /** 测试参数传输 */
            describe.concurrent("单个参数调用与返回值", function () {
                const cases = Object.entries(callbackBaseArgs);
                describe.each(cases)("%s", function (type, dataList) {
                    it.each(dataList as any[])("%s", async function (arg) {
                        const { cpcClient, fn, cmd } = createBase();
                        const res = await cpcClient.call(cmd, [arg]);

                        expect(fn.mock.calls[0], "参数").toEqual([arg]);
                        expect(res, "返回值").toEqual(arg);
                    });
                });

                const cases2 = Object.entries(callBackObjectArgs);
                describe.each(cases2)("%s", function (type, { data, expect: cusExpect }) {
                    it.each(data as any[])("%s", async function (arg) {
                        const { cpcClient, fn, cmd } = createBase();
                        const pms = cpcClient.call(cmd, [arg]);
                        await nextMacaoTask();

                        cusExpect(arg, await pms);
                    });
                });
            });
            describe.concurrent("多参数写入测试", function () {
                const args = Object.entries(callbackBaseArgs);
                it.each(args)(
                    "%s",
                    async function (type, arg) {
                        const { cpcClient, cmd, fn } = createBase();
                        await cpcClient.call(cmd, arg);

                        expect(fn.mock.calls[0], type).toEqual(arg);
                    },
                    100
                );
            });
            /** 测试返回顺序 */
            it("连续调用", async function () {
                const { cpcClient, cmd, fn } = createBase();
                const dataList = callbackBaseArgs.noContent;
                const pmsList: Promise<any>[] = dataList.map((args) => cpcClient.call(cmd, [args]));

                await nextMacaoTask();
                const res = await Promise.all(pmsList);
                expect(res).toEqual(dataList);
            }, 500);
        });
        it("内联调用", async function () {
            let pms: Promise<any>;
            const { cpcClient, cpcServer } = createConnectedFcp(
                { clientFn: () => 7 },
                {
                    fn(this: Cpc) {
                        pms = this.call("clientFn", [true]);
                        return 3;
                    },
                }
            );
            await expect(cpcClient.callNoCheck("fn")).resolves.toBe(3);
            await expect(pms!).resolves.toBe(7);
        });
        describe("返回值", function () {
            const { cpcClient } = createConnectedFcp(undefined, createServerFnCase());

            it("异步返回", async function () {
                const arg = [true, undefined, 4];
                await expect(cpcClient.call("asyncReturnArgs", arg)).resolves.toEqual(arg);
            });

            it("未处理异常", async function () {
                await expect(cpcClient.callNoCheck("cmd99")).rejects.toThrowError(CpcUnregisteredCommandError);
            });
            it("函数抛出Error对象", async function () {
                await expect(cpcClient.callNoCheck("throwError")).rejects.toThrowError("yy");
            });
            it("函数抛出非Error对象", async function () {
                await expect(cpcClient.call("throwArg0", ["abc"])).rejects.toThrow("abc");
            });
            it("异步抛出Error对象", async function () {
                await expect(cpcClient.callNoCheck("asyncThrowError")).rejects.toThrowError("yy");
            });
            it("异步抛出非Error对象", async function () {
                await expect(cpcClient.call("asyncThrowArg0", ["abc"])).rejects.toThrow("abc");
            });
        });
        describe("状态更改", function () {
            function expectFcpClose(cpc: Cpc, closeFn: SpyInstance) {
                expect(closeFn).toBeCalledTimes(1);
                expect(cpc.closed).toBeTruthy();
            }

            it("无等待结束状态执行end()", async function () {
                const { c, s, onErr } = mocks.getInitedStateConnectedCpc();

                c.cpc.end();
                expect(c.cpc.closed).toBeTruthy();
                await nextMacaoTask();
                expect(onErr).not.toBeCalled();
                expect(c.onEnd, "clientEnd").toBeCalledTimes(1);
                expect(c.onClose, "clientClose").toBeCalledTimes(1);

                expect(s.onEnd, "serverEnd").toBeCalledTimes(1);
                expect(s.cpc.closed).toBeTruthy();
                expect(s.onClose, "serverClose").toBeCalledTimes(1);
            });
            it("有等待结束状态执行end()-async返回值", async function () {
                const { c, s } = mocks.getInitedStateConnectedCpc();

                s.cpc.setCmd("cmd", function () {
                    return new Promise((resolve) => setTimeout(resolve, 100));
                });
                const pms = c.cpc.callNoCheck("cmd");
                c.cpc.end();
                await nextMacaoTask(50);
                expect(s.onEnd, "serverEnd").toBeCalledTimes(1);
                expect(c.onEnd, "clientEnd").toBeCalledTimes(1);
                expect(s.onClose, "serverNotClose").not.toBeCalled();
                expect(c.onClose, "clientNotClose").not.toBeCalled();

                expect(s.cpc.closed, "未关闭").toBeFalsy();

                await pms;
                expect(s.onEnd, "serverClose").toBeCalled();
                expect(c.onEnd, "clientClose").toBeCalled();
            });
            it("有等待结束中执行 dispose", async function () {
                const { c, s } = mocks.getInitedStateConnectedCpc();
                s.cpc.end();
                await nextMacaoTask();

                c.cpc.dispose();
                await nextMacaoTask();
                expectFcpClose(s.cpc, s.onClose);
                expectFcpClose(c.cpc, c.onClose);
            });
            it("noFin 执行 dispose", async function () {
                const { c, s } = mocks.getInitedStateConnectedCpc();

                c.cpc.dispose();
                await nextMacaoTask();
                expect(c.onEnd).toBeCalledTimes(1);

                expectFcpClose(c.cpc, c.onClose);
            });
            it("在返回前断开连接", async function () {
                const cpc = getNoResponseCpc();
                const pms = cpc.callNoCheck("yyy");
                await nextMacaoTask();
                expect(cpc.isEnded).toBeFalsy();
                cpc.dispose();
                expect(cpc.closed).toBeTruthy();
                await expect(pms, "在返回前中断").rejects.toThrowError(CpcFailRespondError);
            });
            it("Promise状态在变化前断开连接", async function () {
                const { c, s } = mocks.getInitedStateConnectedCpc();

                s.cpc.setCmd("cmd", function () {
                    return new Promise(function (resolve) {
                        setTimeout(resolve, 500);
                    });
                });
                let pms = c.cpc.callNoCheck("cmd");
                await nextMacaoTask(50);
                c.cpc.dispose();
                expect(c.cpc.closed).toBeTruthy();

                await expect(pms).rejects.toThrowError(CpcFailAsyncRespondError);
            });
        });
    };
}
export function cpcReactionTest(mocks: CpcMocks) {
    const { createConnectedFcp } = mocks;
    async function initGetReaction() {
        const { cpcClient, cpcServer, onErr } = createConnectedFcp();
        const reaction = ReactionController.create<Record<string, any>>({});
        const service = new ReactionService(reaction);
        const fn = vi.fn(() => service);
        cpcServer.setCmd("getReaction", fn);
        const reactionAgent = await cpcClient.call("getReaction", []);
        return { reactionAgent, reaction, service, cpcClient, cpcServer };
    }
    function setListener(reaction: object) {
        const fn = vi.fn();
        ReactionController.get(reaction)?.addListener(fn);
        return fn;
    }
    return function cpcReactionCases() {
        it("返回 reaction", async () => {
            const { reaction, reactionAgent } = await initGetReaction();
            expect(ReactionController.isReaction(reactionAgent)).toBeTruthy();
        });
        it("修改响应", async function () {
            const { reaction, reactionAgent } = await initGetReaction();
            reaction.add = 9; //server 修改
            await new Promise((resolve) => setTimeout(resolve, 50));
            expect(reactionAgent, "agent端变化").toEqual({ add: 9 });

            reactionAgent.add = 8; //agent 修改
            await new Promise((resolve) => setTimeout(resolve, 50));
            expect(reaction, "server端变化").toEqual({ add: 8 });
        });
        it("cancel agent", async function () {
            const { reaction, reactionAgent, service, cpcClient } = await initGetReaction();
            const serverFn = setListener(reaction);
            const agentFn = setListener(reactionAgent);
            const pms = cpcClient.cancelReactionAgent(reactionAgent);

            reaction.add = 9; //server 修改
            reaction.add = "";
            expect(serverFn, "server已响应").toBeCalledTimes(2);

            await pms;
            expect(agentFn, "agent未响应").toBeCalledTimes(0);
            expect(reactionAgent, "agent端无变化").toEqual({});
        });
        it("cancel server", async function () {
            const { reaction, reactionAgent, service, cpcClient } = await initGetReaction();
            const serverFn = setListener(reaction);
            const agentFn = setListener(reactionAgent);

            const pms = cpcClient.cancelReactionServer(reactionAgent);
            reactionAgent.add = 9; //agent 修改
            reactionAgent.add = "";
            expect(agentFn, "agent已响应").toBeCalledTimes(2);
            await pms;

            expect(serverFn, "server未响应").toBeCalledTimes(0);
            expect(reaction, "server端无变化").toEqual({});
        });
    };
}
