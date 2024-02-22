function getPrototypes(obj: object, exclude: Set<object>) {
  const protoList: Record<string | symbol, any>[] = [obj];
  let proto = Reflect.getPrototypeOf(obj);
  while (proto && !exclude.has(proto)) {
    protoList.push(proto);
    proto = Reflect.getPrototypeOf(proto);
  }
  return protoList;
}
const defaultExcludeObj = new Set<object>([
  Object,
  Object.prototype,
  Reflect.getPrototypeOf(Object)!,
  Function,
  Function.prototype,
]);
// const objExcludeKeys = new Set(["constructor"]);
// const functionExcludeKeys = new Set(["prototype"]);

type GenConfig = {
  exclude: Set<object>;
  map: Map<string, RpcFn>;
  sp: string;
};

export function genRpcCmdMap(rootObj: object, base: string, opts: Partial<GenConfig> = {}) {
  const { map = new Map(), sp = "." } = opts;
  let exclude = defaultExcludeObj;
  if (opts.exclude) {
    exclude = new Set(exclude);
    for (const item of opts.exclude) {
      exclude.add(item);
    }
  }
  return privateGenRpcCmdMap(rootObj, base, { exclude, map, sp });
}
function privateGenRpcCmdMap(rootObj: object, base: string, opts: GenConfig) {
  const protoList = getPrototypes(rootObj, opts.exclude);
  let add = 0;
  for (let i = protoList.length - 1; i >= 0; i--) {
    const excludeKeys = typeof protoList[i] === "function" ? "prototype" : "constructor";

    let keys = Object.getOwnPropertyNames(protoList[i]);
    let obj;
    for (const k of keys) {
      // if (typeof k !== "string") continue;
      if (excludeKeys === k) continue;

      obj = (rootObj as any)[k]; //从 rootObj 取值
      if (opts.exclude.has(obj)) continue;

      if (typeof obj === "function") {
        opts.map.set(base ? base + opts.sp + k : k, { fn: obj as Fn, this: rootObj });
        add++;
      } else if (typeof obj !== "object" || obj === null) continue;

      add += privateGenRpcCmdMap(obj, base ? base + opts.sp + k : k, opts);
    }
  }
  return add;
}
type Fn = (...args: any[]) => any;
export type RpcFn = {
  fn: Fn;
  this: any;
};

// const c = Object.getOwnPropertyNames(Abc.__proto__);
// console.log(c);
