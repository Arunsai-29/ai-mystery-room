import { useEffect } from 'react';
import { useMutation, useQuery } from '@tanstack/react-query';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { Check, FileText, LoaderCircle, RefreshCw } from 'lucide-react';
import { casesApi } from '../api/client.js';
import { ErrorCard, Layout, Loading } from '../components/Layout.jsx';

const messages = { queued: 'The case file is being opened…', generating_blueprint: 'Dreaming up the crime…', generating_evidence: 'Writing the recovered evidence…', generating_images: 'Developing photographs…', validating: 'Making sure the mystery can be solved…' };
const stages = ['generating_blueprint', 'generating_evidence', 'generating_images', 'validating'];
const tips = ['Check timestamps against the alibis.', 'A convincing alibi can still contain one missing minute.', 'Look for details that appear in more than one exhibit.'];
export default function Generating() {
  const { id } = useParams(); const nav = useNavigate();
  const query = useQuery({ queryKey: ['case-status', id], queryFn: () => casesApi.status(id), refetchInterval: (q) => ['ready', 'failed'].includes(q.state.data?.status) ? false : 2000 });
  const retry = useMutation({ mutationFn: () => casesApi.retry(id), onSuccess: () => query.refetch() });
  useEffect(() => { if (query.data?.status === 'ready') { const timer = setTimeout(() => nav(`/case/${id}`, { replace: true }), 700); return () => clearTimeout(timer); } }, [query.data?.status, id, nav]);
  if (query.isError) return <Layout compact><ErrorCard message={query.error.message} onRetry={query.refetch}/></Layout>;
  const state = query.data; const percent = state?.progress?.percent || 0;
  return <Layout compact><div className="generating-page"><div className="city-glow"/><div className="gen-file"><div className="gen-file-top"><span className="folder-tab">CONFIDENTIAL</span><FileText size={22}/><span>CASE ASSEMBLY</span></div><div className="gen-radar"><div className="radar-ring ring-a"/><div className="radar-ring ring-b"/><div className="radar-center"><LoaderCircle size={24}/></div><span className="radar-dot dot-a"/><span className="radar-dot dot-b"/></div><span className="section-kicker">INVESTIGATION IN PROGRESS</span><h1>{state?.status === 'ready' ? 'Case file opened.' : messages[state?.progress?.stage || state?.status] || 'Assembling the evidence…'}</h1><p>We’re building a fictional case with clues that lead somewhere.</p><div className="progress-info"><span>CASE ASSEMBLY</span><b>{percent}%</b></div><div className="progress-track"><span style={{ width: `${percent}%` }}/></div><div className="gen-stepper">{stages.map((stage, i) => { const reached = stages.indexOf(state?.progress?.stage || '') >= i; return <span className={reached ? 'complete' : ''} key={stage}>{reached ? <Check size={13}/> : <i/>}{['Blueprint', 'Evidence', 'Photographs', 'Final check'][i]}</span>; })}</div>{state?.status === 'failed' ? <div className="generation-error"><b>We hit a snag assembling the case.</b><p>{state.errorMessage || 'Your investigation is still available. Try once more.'}</p><button className="button primary" onClick={() => retry.mutate()} disabled={retry.isPending}><RefreshCw size={15}/>{retry.isPending ? 'Retrying…' : 'Try again'}</button> <Link to="/" className="text-link">Back home</Link></div> : <><div className="tip-box"><span>FIELD NOTE</span><p>{tips[Math.floor(Date.now() / 12000) % tips.length]}</p></div><div className="gen-footer"><span className="status-dot"/> Your case will be here if you refresh.</div></>}</div></div></Layout>;
}
