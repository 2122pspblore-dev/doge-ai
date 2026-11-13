/* Copyright (c) 2026 2122pspblore-dev. All rights reserved. */
import React from 'react';
import { createRoot } from 'react-dom/client';
import App from './App.jsx';
import PwaInstall from './PwaInstall.jsx';
import './style.css';
createRoot(document.getElementById('root')).render(<><PwaInstall /><App /></>);
