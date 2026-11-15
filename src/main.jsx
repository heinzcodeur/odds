import React from 'react';
import { createRoot } from 'react-dom/client';
import App from './App.jsx';
import SessionGate from './components/SessionGate.jsx';
import './styles.css';

createRoot(document.getElementById('root')).render(<React.StrictMode><SessionGate>{(sessionActions) => <App {...sessionActions} />}</SessionGate></React.StrictMode>);
