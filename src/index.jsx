import { render } from 'solid-js/web'
import './styles/index.css'
import './styles/defaults.css'
import './styles/messagelist.css'
import './styles/reuse.css'
import App from './App.jsx'

const root = document.getElementById('root')

render(() => <App />, root)
