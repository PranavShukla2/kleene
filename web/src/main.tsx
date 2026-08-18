import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';

import { Root } from '@/Root';
import '@/styles.css';

const root = document.getElementById('root');
if (!root) throw new Error('missing #root');

createRoot(root).render(
  <StrictMode>
    <Root />
  </StrictMode>,
);
