import type { Config } from "tailwindcss"

const config: Config = {
  content: [
    "./app/**/*.{ts,tsx}",
    "./components/**/*.{ts,tsx}",
    "./config/**/*.{ts,tsx}",
    "./hooks/**/*.{ts,tsx}",
    "./lib/**/*.{ts,tsx}"
  ],
  theme: {
    extend: {
      colors: {
        brand: {
          50: "#eef8f5",
          100: "#d7eee7",
          600: "#16806a",
          700: "#116756",
          900: "#123c35"
        }
      }
    }
  },
  plugins: []
}

export default config
