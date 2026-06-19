import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    // 锁定测试范围到本项目，避免从父目录运行时扫入其他项目
    root: import.meta.dirname,
    include: ["test/**/*.test.ts"],
  },
});
