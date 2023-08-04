import { RAction, ReactionController, ReactionListener, ReactionActionEvent } from "#rt/cpc/reaction.js";
import { expect, it, describe, vi } from "vitest";

describe("ReactionController", function () {
    describe("isReaction", function () {
        it("is", function () {
            const reaction = ReactionController.create({});
            expect(ReactionController.isReaction(reaction)).toBeTruthy();
        });
        it("no", function () {
            expect(ReactionController.isReaction({})).toBeFalsy();
            expect(ReactionController.isReaction(null)).toBeFalsy();
            expect(ReactionController.isReaction(3)).toBeFalsy();
        });
    });
    describe("get controller", function () {
        it("reaction", function () {
            const reaction = ReactionController.create({});
            const ctrl = ReactionController.get(reaction)!;
            expect(ctrl.target).toBe(reaction);
        });
        it("其他对象", function () {
            const ctrl = ReactionController.get({})!;
            expect(ctrl).toBeUndefined();
        });
    });
});
describe("Reaction", function () {
    describe("不影响初始值", function () {
        it("浅层", function () {
            const source = { num: 8, str: "str" };
            const reaction = ReactionController.create(source);
            reaction.num = 0;
            Reflect.deleteProperty(reaction, "str");
            expect(source).toEqual({ num: 8, str: "str" });
        });
    });
    describe("监听变化", function () {
        describe("set", function () {
            const { ctrl, fn, reaction } = createAndAddListener<{ attr?: number }>({});
            it("new", function () {
                reaction.attr = 0;

                const expectAction: ReactionActionEvent = { type: RAction.set, oldValue: undefined, newValue: 0 };
                expect(fn.mock.calls[0]).toEqual(["attr", expectAction]);
                expect(reaction.attr).toBe(0);
            });
            it("update ", function () {
                reaction.attr = 1;

                const expectAction: ReactionActionEvent = { type: RAction.set, oldValue: 0, newValue: 1 };
                expect(fn.mock.calls[1]).toEqual(["attr", expectAction]);
                expect(reaction.attr).toBe(1);
            });
        });
        describe("delete", function () {
            const { ctrl, fn, reaction } = createAndAddListener<{ attr?: number }>({ attr: 0 });
            it("delete", function () {
                delete reaction.attr;

                const expectAction: ReactionActionEvent = { type: RAction.delete };
                expect(fn.mock.calls[0]).toEqual(["attr", expectAction]);
                expect(Object.hasOwn(reaction, "attr")).toBeFalsy();
            });
        });
    });
    it("addListener", function () {
        const { ctrl, fn, reaction } = createAndAddListener<Record<string, any>>({});
        const fn2 = vi.fn();
        ctrl.addListener(fn2);
        reaction.add = 0;
        expect(fn).toBeCalled();
        expect(fn2).toBeCalled();
    });
    it("removerListener", function () {
        const { ctrl, fn, reaction } = createAndAddListener<Record<string, any>>({});
        ctrl.removerListener(fn);
        reaction.add = 0;
        expect(fn).not.toBeCalled();
    });
    describe("change", function () {
        it("set", function () {
            const { ctrl, fn, reaction } = createAndAddListener<{ attr?: number }>({ attr: 0 });

            ctrl.change("attr", RAction.set, 8);
            expect(reaction.attr).toBe(8);
            const event: ReactionActionEvent = { type: RAction.set, oldValue: 0, newValue: 8 };
            expect(fn.mock.calls[0]).toEqual(["attr", event]);
        });
        it("ignore", function () {
            const { ctrl, fn, reaction } = createAndAddListener<{ attr?: number }>({ attr: 0 });
            const fn2 = vi.fn();
            ctrl.addListener(fn2);
            ctrl.change("attr", RAction.set, 8, fn2);

            expect(fn).toBeCalled();
            expect(fn2).not.toBeCalled();
        });
    });
});

function createAndAddListener<T extends object>(init: T) {
    const ctrl = new ReactionController(init);
    const reaction = ctrl.target;
    const fn = vi.fn();
    ctrl.addListener(fn);
    return { ctrl, reaction, fn };
}
