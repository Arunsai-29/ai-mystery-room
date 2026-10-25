import { tokens } from './src/styles/tokens.js';
export default { content: ['./index.html', './src/**/*.{js,jsx}'], theme: { extend: { colors: { ink: tokens.ink, panel: tokens.panel, amber: tokens.amber, paper: tokens.paper }, fontFamily: { display: ['"Special Elite"', 'monospace'], sans: ['Inter', 'system-ui', 'sans-serif'], mono: ['"JetBrains Mono"', 'monospace'] } } }, plugins: [] };
