export function paseFunction(str: string) {
    if (str.startsWith("[")) return objectFnPase(str);
    const group = str.match(/^(?<name>[^(*]*)\((?<args>[^)*])\)\{(?<body>.*?)}$/)?.groups as
        | undefined
        | { name?: string; args: string; body: string };
    if (!group) throw new Error("Unsupported function");

    const args = paseArgs(group.args);
    return { args, body: group.body };
}
function paseArgs(str: string) {
    return str.trim().split(/\s*,\s*/);
}
function objectFnPase(str: string) {
    throw new Error("Object functions is not support");
}
class Cases {
    static 静态函数() {}
    方法() {}
    async 异步方法() {}
    *生成器方法() {}
    async *异步生成器方法() {}
    基本函数 = function aa(a: number, b: number) {
        return a + b;
    };
    匿名函数 = function (a: number, b: number) {
        return a + b;
    };
    无大括号箭头函数 = (a: number, b: number) => a + b;

    有大括号箭头函数 = (a: number, b: number) => {
        return a + b;
    };
}
class noSported {
    static async 静态异步函数() {}
    static *静态生成器函数() {}
    static async *静态异步生成器函数() {}

    ["动态名称方法"]() {}
    async ["动态名称异步方法"]() {}
    *["动态名称生成器方法"]() {}
    async *["动态名称异步生成器方法"]() {}
}
