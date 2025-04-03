import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// https://vitejs.dev/config/
export default defineConfig({
    plugins: [react()],
    server: {
        proxy: {
            // string shorthand: http://localhost:5173/foo -> http://localhost:4567/foo
            "/api": "http://localhost:8080",
            "/ws": {
                target: "ws://localhost:8080",
                ws: true,
            },
        },
    },
});
