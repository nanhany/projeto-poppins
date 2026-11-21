import React, { useEffect, useState } from 'react';
import { Bell, BookOpen, ClipboardList, LogOut, Plus, ShieldAlert } from 'lucide-react';
import { api } from './services/api.js';
import Catalog from './pages/Catalog.jsx';

const dateTime = (value) => new Date(value).toLocaleString('pt-BR');

function Login({ onLogin }) {
  const [email, setEmail] = useState(''); const [senha, setSenha] = useState(''); const [error, setError] = useState(''); const [busy, setBusy] = useState(false);
  async function submit(event) {
    event.preventDefault(); setError(''); setBusy(true);
    try { const result = await api('/auth/login', { method: 'POST', body: JSON.stringify({ email, senha }) }); localStorage.setItem('poppins_token', result.token); onLogin(result.user); }
    catch (e) { setError(e.message); } finally { setBusy(false); }
  }
  return <main className="login-shell"><section className="login-card"><div className="brand-mark"><Bell size={23}/></div><p className="eyebrow">PAINEL ADMINISTRATIVO</p><h1>Entrar no Poppins</h1><p className="muted">Acesse para organizar os avisos acadêmicos.</p><form onSubmit={submit}><label>E-mail<input type="email" value={email} onChange={e=>setEmail(e.target.value)} required autoComplete="username"/></label><label>Senha<input type="password" value={senha} onChange={e=>setSenha(e.target.value)} required autoComplete="current-password"/></label>{error&&<p className="error">{error}</p>}<button className="primary full" disabled={busy}>{busy?'Entrando…':'Entrar'}</button></form><p className="login-note">Apenas usuários autorizados podem acessar este painel.</p></section></main>;
}

function Composer({ courses, onSent }) {
  const [students, setStudents] = useState([]); const [selected, setSelected] = useState([]); const [form, setForm] = useState({ titulo:'', mensagem:'', categoria:'aviso', id_curso:'', canal:'whatsapp' });
  const [error, setError] = useState(''); const [notice, setNotice] = useState(''); const [busy, setBusy] = useState(false);
  useEffect(()=>{ if(!form.id_curso){setStudents([]);setSelected([]);return;} api(`/students?id_curso=${form.id_curso}`).then(data=>{setStudents(data);setSelected(data.map(x=>x.id_aluno));}).catch(e=>setError(e.message)); },[form.id_curso]);
  function change(key,value){setForm(old=>({...old,[key]:value}));}
  async function submit(event){event.preventDefault();setError('');setNotice('');setBusy(true);try{const result=await api('/notifications',{method:'POST',body:JSON.stringify({...form,ids_alunos:selected})});const failed=result.entregas.filter(x=>x.status_entrega==='falha').length;setNotice(`${result.entregas.length-failed} envio(s) aceito(s) pelo provedor; ${failed} falha(s).`);setForm(old=>({...old,titulo:'',mensagem:''}));onSent();}catch(e){setError(e.message);}finally{setBusy(false);}}
  const toggle = (id) => setSelected(old=>old.includes(id)?old.filter(x=>x!==id):[...old,id]);
  return <section className="panel"><div className="section-heading"><div><p className="eyebrow">NOVO ENVIO</p><h2>Criar notificação</h2><p className="muted">Escreva o aviso acadêmico e selecione alunos com matrícula ativa.</p></div></div><form className="composer" onSubmit={submit}>
    <div className="form-row"><label>Curso<select value={form.id_curso} onChange={e=>change('id_curso',e.target.value)} required><option value="">Selecione um curso</option>{courses.map(c=><option key={c.id_curso} value={c.id_curso}>{c.nome_curso}</option>)}</select></label><label>Categoria<select value={form.categoria} onChange={e=>change('categoria',e.target.value)}><option value="prazo">Prazo</option><option value="prova">Prova</option><option value="aviso">Aviso acadêmico</option></select></label></div>
    <label>Título<input maxLength="120" value={form.titulo} onChange={e=>change('titulo',e.target.value)} required/></label><label>Mensagem<textarea maxLength="1500" rows="4" value={form.mensagem} onChange={e=>change('mensagem',e.target.value)} required/><span className="counter">{form.mensagem.length}/1500</span></label>
    <label>Canal<select value={form.canal} onChange={e=>change('canal',e.target.value)}><option value="whatsapp">WhatsApp (prioritário; SMS como contingência configurada)</option><option value="sms">SMS</option></select></label>
    {form.id_curso&&<div className="recipient-box"><div className="recipient-header"><strong>Alunos elegíveis</strong><span>{selected.length} de {students.length} selecionados</span><button type="button" className="text-button" onClick={()=>setSelected(selected.length===students.length?[]:students.map(x=>x.id_aluno))}>{selected.length===students.length?'Desmarcar todos':'Selecionar todos'}</button></div>{students.length===0?<p className="muted">Nenhum aluno ativo matriculado neste curso.</p>:<div className="student-list">{students.map(s=><label key={s.id_aluno} className="student"><input type="checkbox" checked={selected.includes(s.id_aluno)} onChange={()=>toggle(s.id_aluno)}/><span>{s.nome}<small>{s.telefone}</small></span></label>)}</div>}</div>}
    <p className="policy"><ShieldAlert size={16}/> O Poppins não gera mensagens. Revise o conteúdo e não inclua dados pessoais.</p>{error&&<p className="error">{error}</p>}{notice&&<p className="success">{notice}</p>}<button className="primary" disabled={busy||!selected.length}>{busy?'Enviando…':'Enviar notificação'}</button>
  </form></section>;
}

function History({ refresh }) {
  const [items,setItems]=useState([]);const [error,setError]=useState('');
  useEffect(()=>{api('/notifications').then(setItems).catch(e=>setError(e.message));},[refresh]);
  return <section className="panel"><div className="section-heading"><div><p className="eyebrow">REGISTROS</p><h2>Histórico de envios</h2></div></div>{error&&<p className="error">{error}</p>}<div className="table-wrap"><table><thead><tr><th>Notificação</th><th>Curso</th><th>Data</th><th>Canal</th><th>Entregas</th><th>Falhas</th></tr></thead><tbody>{items.map(n=><tr key={n.id_notificacao}><td><strong>{n.titulo}</strong><small>{n.categoria} · por {n.responsavel}</small></td><td>{n.nome_curso}</td><td>{dateTime(n.data_envio)}</td><td>{n.canal_utilizado}</td><td>{n.total}</td><td><span className={n.falhas?'status-bad':'status-good'}>{n.falhas}</span></td></tr>)}{!items.length&&<tr><td colSpan="6" className="empty">Nenhuma notificação enviada ainda.</td></tr>}</tbody></table></div></section>;
}

function Logs({ refresh }) {
  const [items,setItems]=useState([]);const [error,setError]=useState('');
  useEffect(()=>{api('/logs').then(setItems).catch(e=>setError(e.message));},[refresh]);
  return <section className="panel"><div className="section-heading"><div><p className="eyebrow">AUDITORIA</p><h2>Falhas de envio</h2><p className="muted">Motivo registrado para cada mensagem que não foi aceita pelo provedor.</p></div></div>{error&&<p className="error">{error}</p>}<div className="table-wrap"><table><thead><tr><th>Aluno</th><th>Notificação</th><th>Canal</th><th>Horário</th><th>Motivo</th></tr></thead><tbody>{items.map(x=><tr key={x.id_entrega}><td>{x.aluno}</td><td>{x.titulo}</td><td>{x.canal_utilizado}</td><td>{dateTime(x.data_hora)}</td><td className="reason">{x.motivo_falha}</td></tr>)}{!items.length&&<tr><td colSpan="5" className="empty">Nenhuma falha registrada.</td></tr>}</tbody></table></div></section>;
}

export default function App(){
  const [user,setUser]=useState(()=>{try{return JSON.parse(localStorage.getItem('poppins_user')||'null');}catch{return null;}});
  const [page,setPage]=useState('compose');const [courses,setCourses]=useState([]);const [refresh,setRefresh]=useState(0);const [error,setError]=useState('');
  useEffect(()=>{if(user){localStorage.setItem('poppins_user',JSON.stringify(user));api('/courses').then(setCourses).catch(e=>setError(e.message));}},[user]);
  function login(next){localStorage.setItem('poppins_user',JSON.stringify(next));setUser(next);}
  function logout(){localStorage.removeItem('poppins_token');localStorage.removeItem('poppins_user');setUser(null);}
  if(!user)return <Login onLogin={login}/>;
  const nav=[['compose','Nova notificação',Plus],['history','Histórico',ClipboardList],['logs','Falhas',ShieldAlert],['catalog','Cadastros',BookOpen]];
  return <div className="app-shell"><aside className="sidebar"><div className="logo"><span className="brand-mark"><Bell size={20}/></span><span>Poppins<small>Notificações EAD</small></span></div><div className="institution-label">ÁREA DE TRABALHO</div><nav>{nav.map(([id,label,Icon])=><button key={id} className={page===id?'nav-item active':'nav-item'} onClick={()=>setPage(id)}><Icon size={18}/>{label}</button>)}</nav><div className="sidebar-bottom"><div className="user-card"><div className="avatar">{user.nome?.slice(0,1).toUpperCase()}</div><span>{user.nome}<small>{user.cargo}</small></span></div><button className="logout" onClick={logout}><LogOut size={16}/> Sair</button></div></aside><main className="main"><header className="topbar"><div><span className="breadcrumb">Painel / {nav.find(x=>x[0]===page)?.[1]}</span></div><div className="top-user"><BookOpen size={16}/> {courses.length} curso(s)</div></header><div className="content"><div className="welcome"><div><p className="eyebrow">CENTRAL ACADÊMICA</p><h1>{page==='compose'?'Olá, '+user.nome?.split(' ')[0]:'Acompanhe seus envios'}</h1><p className="muted">Envie informações acadêmicas para alunos matriculados.</p></div></div>{error&&<p className="error">{error}</p>}{page==='compose'?<Composer courses={courses} onSent={()=>setRefresh(x=>x+1)}/>:page==='history'?<History refresh={refresh}/>:page==='logs'?<Logs refresh={refresh}/>:<Catalog user={user} onChange={()=>api('/courses').then(setCourses).catch(e=>setError(e.message))}/>}</div></main></div>;
}
