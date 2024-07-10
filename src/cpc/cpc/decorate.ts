import { ServeFnTransform, SetServeFnOption } from "../core/type.ts";
import { getOrCreateRpcDecorateMeta } from "./registrar.ts";

export function rpcService(path?: string, mode: "exclude" | "include" = "exclude") {
  return (input: new (...args: any[]) => Object, context: ClassDecoratorContext) => {
    context.metadata.path = path;
  };
}

export function rpcFn<A extends any[], R>(option?: ServeFnTransform<A, Awaited<R>>): RpcDecorator<A, R>;
export function rpcFn<A extends any[], R>(base: string, option?: ServeFnTransform<A, Awaited<R>>): RpcDecorator<A, R>;
export function rpcFn(
  option_base?: ServeFnTransform<any[], any> | string,
  option?: ServeFnTransform<any[], any>
): RpcDecorator {
  return function rpcFnDecorate(input, context) {
    if (typeof context.name !== "string") throw new RpcDecorateError();
    let base: string | undefined;
    if (typeof option_base === "string") base = option_base;
    else option = option_base;

    if (!option) option = {};
    switch (context.kind) {
      case "method": {
        const meta = getOrCreateRpcDecorateMeta(context.metadata);
        meta.methods.set(context.name, option);
        break;
      }

      case "field": {
        break;
      }
      default:
        break;
    }
  };
}
export function rpcAlias() {}

class RpcDecorateError extends Error {
  constructor() {
    super("Only string properties are supported");
  }
}

@rpcService("ksd")
class S1 {
  @rpcFn()
  m2(p: number, r: string): string {
    return "";
  }
  @rpcFn()
  att = (data: number) => "dg";
}

class S2 extends S1 {}

type RpcDecorator<A extends any[] = any[], R = any> = (
  input: undefined | ((...args: A) => R),
  context: ClassMethodDecoratorContext | ClassFieldDecoratorContext
) => void;
