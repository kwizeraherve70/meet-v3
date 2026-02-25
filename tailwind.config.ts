import type { Config } from "tailwindcss";

export default {
  darkMode: ["class"],
  content: ["./pages/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}", "./app/**/*.{ts,tsx}", "./src/**/*.{ts,tsx}"],
  safelist: [
    // Ensure emoji reaction animations are always included
    'animate-emoji-bounce',
    'animate-float-up',
  ],
  prefix: "",
  theme: {
    container: {
      center: true,
      padding: "2rem",
      screens: {
        "2xl": "1400px",
      },
    },
    extend: {
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
      },
      colors: {
        border: "hsl(var(--border))",
        input: "hsl(var(--input))",
        ring: "hsl(var(--ring))",
        background: "hsl(var(--background))",
        foreground: "hsl(var(--foreground))",
        primary: {
          DEFAULT: "hsl(var(--primary))",
          foreground: "hsl(var(--primary-foreground))",
        },
        secondary: {
          DEFAULT: "hsl(var(--secondary))",
          foreground: "hsl(var(--secondary-foreground))",
        },
        destructive: {
          DEFAULT: "hsl(var(--destructive))",
          foreground: "hsl(var(--destructive-foreground))",
        },
        success: {
          DEFAULT: "hsl(var(--success))",
          foreground: "hsl(var(--success-foreground))",
        },
        warning: {
          DEFAULT: "hsl(var(--warning))",
          foreground: "hsl(var(--warning-foreground))",
        },
        muted: {
          DEFAULT: "hsl(var(--muted))",
          foreground: "hsl(var(--muted-foreground))",
        },
        accent: {
          DEFAULT: "hsl(var(--accent))",
          foreground: "hsl(var(--accent-foreground))",
        },
        popover: {
          DEFAULT: "hsl(var(--popover))",
          foreground: "hsl(var(--popover-foreground))",
        },
        card: {
          DEFAULT: "hsl(var(--card))",
          foreground: "hsl(var(--card-foreground))",
        },
        control: {
          bar: "hsl(var(--control-bar))",
          hover: "hsl(var(--control-hover))",
        },
        video: {
          bg: "hsl(var(--video-bg))",
        },
        participant: {
          card: "hsl(var(--participant-card))",
        },
        chat: {
          bubble: "hsl(var(--chat-bubble))",
          other: "hsl(var(--chat-bubble-other))",
        },
        online: "hsl(var(--online-indicator))",
        sidebar: {
          DEFAULT: "hsl(var(--sidebar-background))",
          foreground: "hsl(var(--sidebar-foreground))",
          primary: "hsl(var(--sidebar-primary))",
          "primary-foreground": "hsl(var(--sidebar-primary-foreground))",
          accent: "hsl(var(--sidebar-accent))",
          "accent-foreground": "hsl(var(--sidebar-accent-foreground))",
          border: "hsl(var(--sidebar-border))",
          ring: "hsl(var(--sidebar-ring))",
        },
      },
      borderRadius: {
        lg: "var(--radius)",
        md: "calc(var(--radius) - 2px)",
        sm: "calc(var(--radius) - 4px)",
      },
      keyframes: {
        "accordion-down": {
          from: { height: "0" },
          to: { height: "var(--radix-accordion-content-height)" },
        },
        "accordion-up": {
          from: { height: "var(--radix-accordion-content-height)" },
          to: { height: "0" },
        },
        "pulse-ring": {
          "0%": { transform: "scale(0.95)", opacity: "1" },
          "50%": { transform: "scale(1)", opacity: "0.5" },
          "100%": { transform: "scale(0.95)", opacity: "1" },
        },
        "float-up": {
          "0%": { 
            transform: "translateY(0px) scale(0)", 
            opacity: "0" 
          },
          "10%": {
            transform: "translateY(-20px) scale(1.3)",
            opacity: "1"
          },
          "50%": { 
            transform: "translateY(-200px) scale(1)", 
            opacity: "1" 
          },
          "85%": { 
            transform: "translateY(-350px) scale(1)", 
            opacity: "0.7" 
          },
          "100%": { 
            transform: "translateY(-500px) scale(0.8)", 
            opacity: "0" 
          },
        },
        "emoji-bounce": {
          "0%": {
            transform: "translateY(0px) scale(0)",
            opacity: "0"
          },
          "5%": {
            transform: "translateY(-10px) scale(1.4)",
            opacity: "1"
          },
          "15%": {
            transform: "translateY(-40px) scale(1.1)",
            opacity: "1"
          },
          "30%": {
            transform: "translateY(-100px) scale(1.05)",
            opacity: "1"
          },
          "50%": {
            transform: "translateY(-200px) scale(1)",
            opacity: "1"
          },
          "75%": {
            transform: "translateY(-350px) scale(0.95)",
            opacity: "0.6"
          },
          "90%": {
            transform: "translateY(-450px) scale(0.85)",
            opacity: "0.2"
          },
          "100%": {
            transform: "translateY(-550px) scale(0.8)",
            opacity: "0"
          },
        },
      },
      animation: {
        "accordion-down": "accordion-down 0.2s ease-out",
        "accordion-up": "accordion-up 0.2s ease-out",
        "pulse-ring": "pulse-ring 2s ease-in-out infinite",
        "float-up": "float-up 3s cubic-bezier(0.25, 0.46, 0.45, 0.94) forwards",
        "emoji-bounce": "emoji-bounce 3s cubic-bezier(0.34, 1.56, 0.64, 1) forwards",
      },
    },
  },
  plugins: [require("tailwindcss-animate")],
} satisfies Config;
