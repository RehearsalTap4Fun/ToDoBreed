import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App'
import { StyleLab } from './ui/StyleLab'
import { QLab } from './ui/QLab'
import './styles.css'

const params = new URLSearchParams(location.search)
const page = params.has('qlab') ? <QLab /> : params.has('lab') ? <StyleLab /> : <App />

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>{page}</React.StrictMode>,
)
