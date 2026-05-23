# TODO

- [ ] 补全 [docs/frame_type.md](docs/frame_type.md#L124) 中的 "All types of content" 小节，当前仍是占位文本。
- [ ] 处理 [src/web/web_socket.ts](src/web/web_socket.ts#L62) 中的待办：当源关闭后，直接关闭 callee 和 caller，避免当前只在发送时兜底。
- [ ] 拆分 [test/core/cpcall_status.test.ts](test/core/cpcall_status.test.ts#L105) 里的状态测试；现有注释指出也许应该改成更强制的中断场景。
- [ ] 完成 [test/exmaples/authentication.test.ts](test/exmaples/authentication.test.ts#L4) 的认证示例测试，目前仍是 describe.todo。
- [ ] 跟踪上游装饰器支持：当前因为上游依赖问题，Vite 8 不支持 ES decorators，而 Vite 7 可用。等 Vite 或 Vitest 恢复对 ES decorators 的支持后，移除项目中的 Vite 依赖及相关接入（见 [package.json](package.json) 和 [vitest.config.ts](vitest.config.ts)）。
