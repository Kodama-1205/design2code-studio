import type { Config } from "tailwindcss";

export default {
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        bg: "rgb(var(--bg))",
        surface: "rgb(var(--surface))",
        surface2: "rgb(var(--surface2))",
        text: "rgb(var(--text))",
        muted: "rgb(var(--muted))",
        border: "rgb(var(--border))",
        primary: "rgb(var(--primary))",
        primary2: "rgb(var(--primary2))"
      },
      boxShadow: {
        soft: "0 10px 30px rgba(0,0,0,0.18)"
      }
    }
  },
  plugins: []
} satisfies Config;
