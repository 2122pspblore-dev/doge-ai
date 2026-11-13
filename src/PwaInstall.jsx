/* Copyright (c) 2026 2122pspblore-dev. All rights reserved. */
import { useEffect, useState } from 'react';
import { Download, X, Chrome } from 'lucide-react';

export default function PwaInstall() {
  const [installEvent, setInstallEvent] = useState(null);
  const [visible, setVisible] = useState(false);
  const [help, setHelp] = useState(false);

  useEffect(() => {
    if ('serviceWorker' in navigator && (location.protocol === 'https:' || location.hostname === 'localhost')) {
      navigator.serviceWorker.register('/sw.js').catch(error => console.warn('DOGE AI offline support unavailable:', error));
    }
    const onPrompt = event => {
      event.preventDefault();
      setInstallEvent(event);
      setVisible(true);
    };
    const onInstalled = () => {
      setInstallEvent(null);
      setVisible(false);
      setHelp(false);
    };
    window.addEventListener('beforeinstallprompt', onPrompt);
    window.addEventListener('appinstalled', onInstalled);
    const isStandalone = window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone;
    setVisible(!isStandalone);
    return () => {
      window.removeEventListener('beforeinstallprompt', onPrompt);
      window.removeEventListener('appinstalled', onInstalled);
    };
  }, []);

  async function install() {
    if (!installEvent) {
      setHelp(true);
      return;
    }
    installEvent.prompt();
    await installEvent.userChoice;
    setInstallEvent(null);
  }

  if (!visible) return null;
  return <div className="doge-pwa-install" role="region" aria-label="Install DOGE AI">
    <div className="doge-pwa-copy"><b>Install DOGE AI</b><span>Use it like a Chromebook app, in its own window.</span></div>
    <button type="button" onClick={install}><Download size={15}/>{installEvent ? 'Install app' : 'How to install'}</button>
    <button type="button" className="doge-pwa-dismiss" aria-label="Dismiss install prompt" onClick={() => setVisible(false)}><X size={15}/></button>
    {help && <div className="doge-pwa-help"><b><Chrome size={14}/> Install from Chrome</b><p>Open DOGE AI in Chrome, then use the install icon in the address bar. If it is not shown, open ⋮ → Cast, save, and share → Install page as app (wording may vary).</p><button type="button" onClick={() => setHelp(false)}>Got it</button></div>}
  </div>;
}
