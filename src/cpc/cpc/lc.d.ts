interface GenCall<CallList extends {} = CpcCmdList> {
  /**
   * @throws {CpcUnregisteredCommandError} 调用未注册的命令
   * @throws {CpcFailRespondError}  在返回前断开连接
   * @throws {CpcFailAsyncRespondError} 已返回 AsyncId (命令已被执行), 但Promise状态在变化前断开连接
   */
  call<T extends GetCmds<CallList>, Fn extends CmdFn = GetFn<CallList[T]>>(
    cmd: T,
    ...args: Parameters<Fn>
  ): Promise<ReturnType<Fn>>;
}
interface GenExec<CallList extends {} = CpcCmdList> {
  exec<T extends GetCmds<CallList>, Arg extends any[] = Parameters<GetFn<CallList[T]>>>(cmd: T, ...arg: Arg): void;
}

type GetFn<T> = T extends CmdFn ? T : never;
type PickFn<T> = {
  [key in keyof T as T[key] extends (...args: any[]) => any ? key : never]: T[key];
};

type GetCmds<T> = keyof PickFn<T>;

type CmdFn = (...args: any[]) => any;

/**  @public  */
export type CpcCmdList = {
  [key: string | number]: (...args: any[]) => any;
};
