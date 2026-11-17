import React from 'react';
import { createRoot } from 'react-dom/client';
import ProfileApp from './components/ProfileApp.jsx';
import SessionGate from './components/SessionGate.jsx';
import './styles.css';

createRoot(document.getElementById('root')).render(<React.StrictMode><SessionGate>{(sessionActions) => <ProfileApp {...sessionActions} />}</SessionGate></React.StrictMode>);
