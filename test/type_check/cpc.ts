import { Cpc } from "cpcall";

interface CallList {
    bbb(id: number, grade: number): number;
    aaa(): number;
    s: number;
}

let a = {} as any as Cpc<CallList, CallList>;
let r1 = a.call("aaa", []);
let r3 = a.call("aaa");
let r2 = a.call("bbb", [2, 4]);
a.setCmd("aaa", () => 3);
a.setCmd("bbb", (id: number, grade: number) => 2);

a.call("aaa", [1, 3]); //aaa没有参数
a.call("bbb", []); //bbb有参数
a.call("bbb"); //bbb有参数
a.call("bbb2", [2, 4]); //不存在bbb2
a.call("bbb2"); //不存在bbb2

a.setCmd("aaa", (id: number) => true); //aaa没有参数
a.setCmd("aaa", () => {}); //aaa返回boolean
a.setCmd("bbbb", (y: number) => undefined); //不存在命令

let b = {} as any as Cpc;
b.call("skd", []);
b.call("skd", [2, 4]);
b.call("skd");
b.setCmd("bbbb", (y: number) => undefined);
