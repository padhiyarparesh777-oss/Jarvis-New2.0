import { createRoot } from 'react-dom/client';
import App from './App.tsx';
import './index.css';
import { installGlobalDiagnosticCapture } from './modules/developer/diagnostics';

installGlobalDiagnosticCapture();

createRoot(document.getElementById('root')!).render(<App />);
