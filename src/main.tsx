import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App'
import { StyleLab } from './ui/StyleLab'
import './styles.css'

const isLab = new URLSearchParams(location.search).has('lab')

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>{isLab ? <StyleLab /> : <App />}</React.StrictMode>,
)
