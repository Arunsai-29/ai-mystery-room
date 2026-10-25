import { Navigate, Route, Routes } from 'react-router-dom';
import Home from './pages/Home.jsx';
import Generating from './pages/Generating.jsx';
import CaseRoom from './pages/CaseRoom.jsx';
import Result from './pages/Result.jsx';
import { Layout } from './components/Layout.jsx';

function NotFound() { return <Layout><div className="not-found"><span className="confidential-stamp">MISSING</span><h1>Case file not found</h1><p>It may have been removed or belong to a different session.</p><a className="button primary" href="/">Return to the archive</a></div></Layout>; }
export default function App() { return <Routes><Route path="/" element={<Home/>}/><Route path="/case/:id/generating" element={<Generating/>}/><Route path="/case/:id" element={<CaseRoom/>}/><Route path="/case/:id/result" element={<Result/>}/><Route path="*" element={<NotFound/>}/></Routes>; }
