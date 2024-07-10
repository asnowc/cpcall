declare global {
  interface SymbolConstructor {
    readonly metadata: unique symbol;
  }
}
if (!Symbol.metadata) {
  //@ts-ignore
  Symbol.metadata = Symbol("cpcall metadata");
}
