import React from 'react';
import ReactDOM from 'react-dom/client';
import { HashRouter as BrowserRouter, Routes, Route, NavLink, useNavigate } from 'react-router-dom';
import './index.css';
import AddTrade from './pages/AddTrade';
import Stats from './pages/Stats';
import Journal from './pages/Journal';
import Settings from './pages/Settings';
import SupabaseStatus from './SupabaseStatus';

function Nav() {
  const navigate = useNavigate();
  return (
    <nav className="nav">
      <div className="nav-logo">pip<span>log</span></div>
      <div className="nav-links">
        <NavLink to="/" end className={({isActive}) => 'nav-link' + (isActive ? ' active' : '')}>journal</NavLink>
        <NavLink to="/stats" className={({isActive}) => 'nav-link' + (isActive ? ' active' : '')}>statistics</NavLink>
        <NavLink to="/settings" className={({isActive}) => 'nav-link' + (isActive ? ' active' : '')}>settings</NavLink>
      </div>
      <button className="btn btn-primary" onClick={() => navigate('/add')}>+ new trade</button>
    </nav>
  );
}

function App() {
  return (
    <BrowserRouter>
      <Nav />
      <SupabaseStatus />
      <Routes>
        <Route path="/" element={<Journal />} />
        <Route path="/add" element={<AddTrade />} />
        <Route path="/edit/:id" element={<AddTrade />} />
        <Route path="/stats" element={<Stats />} />
        <Route path="/settings" element={<Settings />} />
      </Routes>
    </BrowserRouter>
  );
}

const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(<App />);
