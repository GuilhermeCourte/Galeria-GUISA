import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.jsx'
import './App.css' // Importa o CSS que definimos anteriormente

// Bloqueia o botão direito do mouse
document.addEventListener('contextmenu', event => event.preventDefault());

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
)