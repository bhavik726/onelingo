import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./src/**/*.{js,ts,jsx,tsx,mdx}"],
  theme: {
    extend: {
      colors: {
        duo: {
          green: "#58CC02",
          darkGreen: "#46A302",
          blue: "#1CB0F6",
          ink: "#3C3C3C",
          muted: "#777777",
          line: "#E5E5E5",
          paper: "#FFFFFF",
          background: "#F7F7F7"
        }
      },
      boxShadow: {
        button: "0 4px 0 #46A302",
        card: "0 2px 0 #E5E5E5"
      }
    }
  },
  plugins: []
};
export default config;
