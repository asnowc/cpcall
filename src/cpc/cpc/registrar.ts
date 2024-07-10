import { ServeFnConfig } from "./type.ts";

export class Registrar {
  #map?: ServeMap | ServeObjectRoot;

  removeServe(path?: string[]): boolean {
    if (!path || path.length === 0) {
      let has = Boolean(this.#map);
      this.#map = undefined;
      return has;
    }
    let { i, map, root } = this.getServeRoot(path);
    if (!root || i !== path.length) return false;
    if (!map) return false;
    return map.delete(path[path.length - 1]);
  }
  clear() {
    this.#map = undefined;
  }

  separator = ".";
  setObject(serve: object, path: string[] = []) {
    let max = path.length - 1;
    if (max >= 0) {
      let { i, map, root: object } = this.getServeRoot(path);
      let max = path.length - 1;
      if (object) throw new Error(`path '${path.join(this.separator)}' has set object`);
      else if (i > max) throw new Error(`path '${path.join(this.separator)}' points to a set object`);

      if (!map) {
        map = new Map();
        this.#map = map;
      }

      while (i < max) {
        let sub = new Map();
        map.set(path[i++], sub);
        map = sub;
      }

      map.set(path[max], {
        object: serve,
      });
    } else {
      if (this.#map) throw new Error(`root has set object`);
      this.#map = { object: serve };
    }
  }
  private getServeRoot(path: string[]) {
    let item = this.#map;
    if (item instanceof Map) {
      let i = 0;
      let parent: ServeMap | undefined;
      while (i < path.length) {
        parent = item;
        item = item.get(path[i]);
        if (item instanceof Map) i++;
        else if (item) {
          return { i: i + 1, map: parent, root: item };
        } else {
          return { i, map: parent };
        }
      }
      return { i, map: parent };
    }
    return { i: 0, map: undefined, root: item };
  }
  getServe(path: string[]): ExecutionContext | undefined {
    let { i, root } = this.getServeRoot(path);
    let max = path.length - 1;

    if (!root || i > max) return;

    let context = root.object as any;
    let rpcMeta: ServiceConfig | undefined = getObjectRpcDecorateMeta(context);
    let key: string;
    while (i < max) {
      key = path[i++];
      if (rpcMeta) {
        if (rpcMeta.mode === ServiceDefineMode.exclude) {
          if (rpcMeta.excludes!.has(key)) return undefined;
        } else {
          if (!rpcMeta.includes.has(key)) return undefined;
        }
        context = context[key];
      } else {
        context = context[key];
      }
      rpcMeta = getObjectRpcDecorateMeta(context);
    }

    const field = path[max];
    let meta: ServeFnConfig | undefined;
    if (rpcMeta) {
      if (rpcMeta.mode === ServiceDefineMode.exclude) {
        if (rpcMeta.excludes!.has(field)) return;
        meta = rpcMeta.includes.get(field) ?? {};
      } else {
        meta = rpcMeta.includes.get(field);
        if (!meta) return;
      }
    } else {
      meta = {};
    }
    return { this: context, fn: context[field], meta };
  }
}

/** @public */
export enum ServiceDefineMode {
  include = 0,
  exclude = 1,
}
export const SymbolMetadata = Symbol.metadata;
export function getObjectRpcDecorateMeta(object: object): ServiceConfig | undefined {
  const prototype = Reflect.getPrototypeOf(object);
  if (!prototype) return;
  const constructor = prototype.constructor;
  if (!constructor) return;

  const meta = Reflect.get(constructor, SymbolMetadata);
  if (!meta) return;
  return RPC_SERVICE_META_MAP.get(meta);
}

export type ServiceConfig = {
  includes: Map<string, ServeFnConfig>;
  mode?: ServiceDefineMode;
  excludes?: Set<string>;
};
const RPC_SERVICE_META_MAP = new WeakMap<WeakKey, ServiceConfig>();
export function getOrCreateRpcDecorateMeta(meta: object): ServiceConfig {
  let rpcMeta = RPC_SERVICE_META_MAP.get(meta);
  if (!rpcMeta) {
    rpcMeta = { includes: new Map() };
    RPC_SERVICE_META_MAP.set(meta, rpcMeta);
  }

  return rpcMeta;
}

type ServeObjectRoot = {
  object: object;
};
type ServeMap = Map<string, ServeMap | ServeObjectRoot>;
export type ExecutionContext = {
  this?: object;
  fn: (...args: any[]) => any;
  meta: ServeFnConfig;
};
