/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        background: '#050811',
        surface: 'rgba(10, 16, 30, 0.75)',
        cyanGlow: '#06B6D4',
        agentViolet: '#8B5CF6',
        emeraldSignal: '#10B981',
        amberSignal: '#F59E0B',
        crimsonSignal: '#EF4444',
        sapphireEmergency: '#3B82F6',
      },
      boxShadow: {
        'cyan-glow': '0 0 20px rgba(6, 182, 212, 0.35)',
        'violet-glow': '0 0 20px rgba(139, 92, 246, 0.35)',
        'crimson-glow': '0 0 25px rgba(239, 68, 68, 0.45)',
        'emerald-glow': '0 0 20px rgba(16, 185, 129, 0.4)',
      }
    },
  },
  plugins: [],
}
