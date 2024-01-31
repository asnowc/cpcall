function getObjectMethods(rootObj: object, exclude: object = Object.prototype, base = "") {
  const protoList = getPrototypes(rootObj, exclude);
  const map = new Map<string, Fn>();

  let current: (typeof protoList)[0];
  for (let i = protoList.length - 1; i >= 0; i--) {
    current = protoList[i];
    for (const k of Reflect.ownKeys(current)) {
      if (typeof k !== "string") continue;
      if (typeof current[k] === "function") map.set(base + k, current[k]);
    }
  }
  return map;
}
function getPrototypes(obj: object, exclude: object) {
  const protoList: Record<string | symbol, any>[] = [obj];
  let proto = Reflect.getPrototypeOf(obj);
  while (proto && proto !== exclude) {
    protoList.push(proto);
    proto = Reflect.getPrototypeOf(proto);
  }
  return protoList;
}
export function genRpcCmdMap(
  rootObj: object,
  base: string,
  opts: {
    exclude: object;
    map: Map<string, RpcFn>;
    sp: string;
  }
) {
  const protoList = getPrototypes(rootObj, opts.exclude);

  let current: (typeof protoList)[0];
  for (let i = protoList.length - 1; i >= 0; i--) {
    current = protoList[i];
    for (const k of Reflect.ownKeys(current)) {
      if (typeof k !== "string") continue;
      switch (typeof current[k]) {
        case "function":
          opts.map.set(base + k, { fn: current[k] as Fn, this: current });
          break;
        case "object": {
          if (current[k] === null) break;
          genRpcCmdMap(current[k], base + opts.sp, opts);
          break;
        }
      }
    }
  }
  return opts.map;
}
type Fn = (...args: any[]) => any;
export type RpcFn = {
  fn: Fn;
  this: any;
};
