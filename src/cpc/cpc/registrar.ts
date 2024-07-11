import { ServeFnConfig } from "./type.ts";

export function getServe(root: ServeObjectRoot, path: string[]): ExecutionContext | undefined {
  let max = path.length - 1;

  let context = root.object as any;
  let rpcMeta: ServiceConfig | undefined = getObjectRpcDecorateMeta(context);
  let key: string;
  let i = 0;
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
  const fn = context[field];
  if (typeof fn !== "function") return undefined;
  return { this: context, fn, meta };
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

export type ServeObjectRoot = {
  object: object;
};
export type ExecutionContext = {
  this?: object;
  fn: (...args: any[]) => any;
  meta: ServeFnConfig;
};
