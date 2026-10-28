import React from 'react';
import ReactDOM from 'react-dom/client';
import { AdminApp } from './components/admin/AdminApp';
import './index.css';

document.documentElement.classList.add('dark');
document.documentElement.dataset.theme = 'default';

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <div className="dark h-dvh overflow-y-auto bg-background text-foreground"><AdminApp /></div>
  </React.StrictMode>,
);
