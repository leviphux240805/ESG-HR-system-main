import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), "");
  return {
    // Bản đăng thành trang tĩnh trong thư mục con (Artifact): đường dẫn tài nguyên tương đối, VITE_BASE=./
    base: env.VITE_BASE || "/",
    server: {
      host: "::",
      port: 8080,
      // Gọi API cùng origin để cookie refresh (SameSite=Strict, httpOnly) hoạt động khi dev
      proxy: {
        "/api": {
          target: env.VITE_API_PROXY_TARGET || "http://localhost:8081",
          changeOrigin: false,
        },
      },
    },
    plugins: [react()],
    resolve: {
      alias: {
        "@": path.resolve(__dirname, "./src"),
      },
    },
  };
});
