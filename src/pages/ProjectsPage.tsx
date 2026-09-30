import { useEffect, useState } from 'react'
import { Plus, Pencil, Trash2, ExternalLink, Github, X, Loader, Download, RefreshCw } from 'lucide-react'
import { useAppStore } from '@/store'
import { AnimBg } from '@/components/ui/AnimBg'
import { projectsApi, fileApi, githubApi, fmtDate, tl, dl } from '@/lib/api'
import { ViewToggle } from '@/components/ui/ViewToggle'
import { FileUpload } from '@/components/ui/FileUpload'
import { GITHUB_USER, SHOWCASE_REPOS } from '@/data/projects'
import type { GhRepo } from '@/lib/api'
import type { Project, ViewMode } from '@/types'

const LANG_COLOR: Record<string, string> = {
  Python: '#3572A5', TypeScript: '#3178c6', HTML: '#e34c26', Shell: '#89e051',
}
const LANG_FALLBACK = 'var(--text3)'

function ProjectEditor({ item, onSave, onClose }: { item?: Project; onSave:(d:Record<string,unknown>)=>Promise<void>; onClose:()=>void }) {
  const { lang } = useAppStore()
  const [form, setForm] = useState({
    title_en: item?.title_en??'', title_zh: item?.title_zh??'',
    desc_en: item?.desc_en??'', desc_zh: item?.desc_zh??'',
    is_open_source: item?.is_open_source??0,
    tech_stack: item?.tech_stack??'',
    version: item?.version??'',
    url: item?.url??'',
    preview_key: item?.preview_key??'',
    tab: item?.tab??'mine',
  })
  const [saving, setSaving] = useState(false)
  async function submit(e: React.FormEvent) {
    e.preventDefault(); setSaving(true)
    await onSave({...form, is_open_source: Number(form.is_open_source)})
    setSaving(false); onClose()
  }
  return (
    <div className="modal-backdrop" onClick={e=>{if(e.target===e.currentTarget)onClose()}}>
      <div className="modal">
        <div className="modal-header">
          <h2>{lang==='zh'?'编辑项目':'Edit Project'}</h2>
          <button className="btn-icon" onClick={onClose}><X size={16}/></button>
        </div>
        <form onSubmit={submit} style={{display:'flex',flexDirection:'column',gap:'.85rem'}}>
          <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:'.85rem'}}>
            <div className="field"><label>Title (EN)</label><input value={form.title_en} onChange={e=>setForm(v=>({...v,title_en:e.target.value}))}/></div>
            <div className="field"><label>{lang==='zh'?'标题（中）':'Title (ZH)'}</label><input value={form.title_zh} onChange={e=>setForm(v=>({...v,title_zh:e.target.value}))}/></div>
          </div>
          <div className="field"><label>Desc (EN)</label><textarea value={form.desc_en} onChange={e=>setForm(v=>({...v,desc_en:e.target.value}))}/></div>
          <div className="field"><label>{lang==='zh'?'描述（中）':'Desc (ZH)'}</label><textarea value={form.desc_zh} onChange={e=>setForm(v=>({...v,desc_zh:e.target.value}))}/></div>
          <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:'.85rem'}}>
            <div className="field">
              <label>{lang==='zh'?'类型':'Type'}</label>
              <select value={form.tab} onChange={e=>setForm(v=>({...v,tab:e.target.value as 'mine'|'recommend'}))}>
                <option value="mine">{lang==='zh'?'我的作品':'My Work'}</option>
                <option value="recommend">{lang==='zh'?'软件推荐':'Recommend'}</option>
              </select>
            </div>
            <div className="field">
              <label>{lang==='zh'?'开源/闭源':'Open / Closed'}</label>
              <select value={form.is_open_source} onChange={e=>setForm(v=>({...v,is_open_source:Number(e.target.value)}))}>
                <option value={1}>{lang==='zh'?'开源（链接到 GitHub）':'Open Source (GitHub)'}</option>
                <option value={0}>{lang==='zh'?'闭源（下载链接）':'Closed Source (Download)'}</option>
              </select>
            </div>
          </div>
          <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:'.85rem'}}>
            <div className="field"><label>{lang==='zh'?'技术栈（逗号分隔）':'Tech stack (comma)'}</label><input value={form.tech_stack} placeholder="Python, React, C++" onChange={e=>setForm(v=>({...v,tech_stack:e.target.value}))}/></div>
            <div className="field"><label>{lang==='zh'?'版本号':'Version'}</label><input value={form.version} placeholder="v1.0.0" onChange={e=>setForm(v=>({...v,version:e.target.value}))}/></div>
          </div>
          <div className="field">
            <label>{lang==='zh'?form.is_open_source?'GitHub 仓库链接':'下载链接（网盘/Releases）':'URL (GitHub or download link)'}</label>
            <input value={form.url} placeholder="https://" onChange={e=>setForm(v=>({...v,url:e.target.value}))}/>
          </div>
          <div className="field">
            <label>{lang==='zh'?'预览截图':'Preview screenshot'}</label>
            <FileUpload accept=".jpg,.jpeg,.png,.webp,.gif,.svg" currentKey={form.preview_key||null} onUploaded={k=>setForm(v=>({...v,preview_key:k}))}
              hint={lang==='zh'?'支持 JPG / PNG / WebP / GIF':'JPG / PNG / WebP / GIF'}/>
          </div>
          <div className="modal-footer">
            <button type="button" className="btn-ghost" onClick={onClose}>{lang==='zh'?'取消':'Cancel'}</button>
            <button type="submit" className="btn-primary" disabled={saving}>
              {saving?<Loader size={14} className="spin"/>:null}{lang==='zh'?'保存':'Save'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

export function ProjectsPage() {
  const { lang, isAdmin, token } = useAppStore()
  const [projects, setProjects] = useState<Project[]>([])
  const [tab, setTab]           = useState<'mine'|'recommend'>('mine')
  const [view, setView]         = useState<ViewMode>('card')
  const [editing, setEditing]   = useState<Project|null|'new'>(null)
  const [ghRepos, setGhRepos]   = useState<GhRepo[]>([])
  const [ghStatus, setGhStatus] = useState<'loading'|'ok'|'stale'|'error'>('loading')

  async function load() { const r=await projectsApi.list(); if(r.ok&&r.data) setProjects(r.data) }
  async function loadGithub() {
    setGhStatus('loading')
    const r = await githubApi.repos(GITHUB_USER)
    setGhRepos(r.repos)
    setGhStatus(r.ok ? (r.stale ? 'stale' : 'ok') : 'error')
  }
  useEffect(()=>{ load(); loadGithub() },[])

  async function save(data: Record<string,unknown>) {
    if(editing==='new') await projectsApi.create(token!,data)
    else if(editing) await projectsApi.update(token!,editing.id,data)
    await load()
  }
  async function del(id: string) {
    if(!confirm(lang==='zh'?'确认删除？':'Delete?')) return
    await projectsApi.remove(token!,id); await load()
  }

  const visible = projects.filter(p=>p.tab===tab)
  const openSource  = visible.filter(p=>p.is_open_source===1)
  const closedSource = visible.filter(p=>p.is_open_source===0)

  // 白名单里被改名/删掉的仓库直接跳过，不占位
  const showcase = SHOWCASE_REPOS
    .map(name => ghRepos.find(r => r.name === name))
    .filter((r): r is GhRepo => !!r)

  function LangDot({ l }: { l: string|null }) {
    if(!l) return null
    return (
      <span style={{display:'inline-flex',alignItems:'center',gap:'.3rem',fontSize:'.72rem',color:'var(--text3)'}}>
        <span style={{width:8,height:8,borderRadius:'50%',background:LANG_COLOR[l]??LANG_FALLBACK,flexShrink:0}}/>{l}
      </span>
    )
  }

  function ShowcaseCard({ r }: { r: GhRepo }) {
    return (
      <div className="card" style={{display:'flex',flexDirection:'column',gap:'.75rem'}}>
        <div style={{display:'flex',alignItems:'center',gap:'.5rem',flexWrap:'wrap'}}>
          <span style={{fontWeight:700,fontSize:'.97rem'}}>{r.name}</span>
          {r.archived&&<span className="badge badge-closed">{lang==='zh'?'已归档':'Archived'}</span>}
        </div>
        <p style={{fontSize:'.83rem',lineHeight:1.6,margin:0,
          color:r.description?'var(--text2)':'var(--text3)',
          fontStyle:r.description?'normal':'italic'}}>
          {r.description || (lang==='zh'?'描述待补':'No description yet')}
        </p>
        <div style={{display:'flex',alignItems:'center',gap:'.9rem',flexWrap:'wrap',marginTop:'auto'}}>
          <LangDot l={r.language}/>
          {r.stargazers_count>0&&(
            <span style={{fontSize:'.72rem',color:'var(--text3)',fontFamily:"'Space Mono',monospace"}}>★ {r.stargazers_count}</span>
          )}
          <span style={{fontSize:'.72rem',color:'var(--text3)',fontFamily:"'Space Mono',monospace"}}>
            {lang==='zh'?'更新于':'Updated'} {fmtDate(r.pushed_at)}
          </span>
        </div>
        <a href={r.html_url} target="_blank" rel="noopener noreferrer" className="btn-ghost"
          style={{display:'inline-flex',alignItems:'center',gap:'.45rem',fontSize:'.82rem',padding:'.5rem 1rem',alignSelf:'flex-start'}}>
          <Github size={14}/>{lang==='zh'?'查看仓库':'View Repo'}<ExternalLink size={11}/>
        </a>
      </div>
    )
  }

  function ShowcaseListItem({ r }: { r: GhRepo }) {
    return (
      <div className="list-item">
        <Github size={14} style={{flexShrink:0,color:'var(--text3)'}}/>
        <div style={{flex:1,minWidth:0}}>
          <div style={{fontWeight:600,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{r.name}</div>
          <div style={{fontSize:'.75rem',color:'var(--text3)',fontFamily:"'Space Mono',monospace",overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>
            {r.language??'—'} · {fmtDate(r.pushed_at)}{r.description?' · '+r.description:''}
          </div>
        </div>
        {r.stargazers_count>0&&(
          <span style={{fontSize:'.72rem',color:'var(--text3)',fontFamily:"'Space Mono',monospace",flexShrink:0}}>★ {r.stargazers_count}</span>
        )}
        <a href={r.html_url} target="_blank" rel="noopener noreferrer" className="btn-icon" style={{width:26,height:26,flexShrink:0}}>
          <ExternalLink size={12}/>
        </a>
      </div>
    )
  }

  function ProjectCard({ p }: { p: Project }) {
    const techs = p.tech_stack ? p.tech_stack.split(',').map(t=>t.trim()).filter(Boolean) : []
    return (
      <div className="card" style={{display:'flex',flexDirection:'column',gap:'.75rem'}}>
        {p.preview_key && (
          <img src={fileApi.url(p.preview_key)} alt={tl(p,lang)}
            style={{width:'100%',aspectRatio:'16/9',objectFit:'cover',borderRadius:'var(--radius-sm)'}}/>
        )}
        <div style={{display:'flex',alignItems:'flex-start',justifyContent:'space-between',gap:'.5rem'}}>
          <div style={{flex:1}}>
            <div style={{display:'flex',alignItems:'center',gap:'.5rem',flexWrap:'wrap',marginBottom:'.35rem'}}>
              <span style={{fontWeight:700,fontSize:'.97rem'}}>{tl(p,lang)}</span>
              {p.version&&<span style={{fontSize:'.68rem',color:'var(--text3)',fontFamily:"'Space Mono',monospace"}}>{p.version}</span>}
              <span className={`badge ${p.is_open_source?'badge-open':'badge-closed'}`}>
                {p.is_open_source?(lang==='zh'?'开源':'Open Source'):(lang==='zh'?'闭源':'Closed')}
              </span>
            </div>
            <p style={{fontSize:'.83rem',color:'var(--text2)',lineHeight:1.6}}>{dl(p,lang)}</p>
          </div>
          {isAdmin&&(
            <div style={{display:'flex',gap:'.3rem',flexShrink:0}}>
              <button className="btn-icon" style={{width:26,height:26}} onClick={()=>setEditing(p)}><Pencil size={12}/></button>
              <button className="btn-icon" style={{width:26,height:26}} onClick={()=>del(p.id)}><Trash2 size={12}/></button>
            </div>
          )}
        </div>
        {techs.length>0&&(
          <div style={{display:'flex',gap:'.35rem',flexWrap:'wrap'}}>
            {techs.map(t=><span key={t} className="tag tag-gray">{t}</span>)}
          </div>
        )}
        {p.url&&(
          <a href={p.url} target="_blank" rel="noopener noreferrer"
            className={p.is_open_source?'btn-ghost':'btn-primary'}
            style={{display:'inline-flex',alignItems:'center',gap:'.45rem',fontSize:'.82rem',padding:'.5rem 1rem',alignSelf:'flex-start',marginTop:'auto'}}>
            {p.is_open_source?<Github size={14}/>:<Download size={14}/>}
            {p.is_open_source?(lang==='zh'?'查看仓库':'View Repo'):(lang==='zh'?'下载':'Download')}
            <ExternalLink size={11}/>
          </a>
        )}
      </div>
    )
  }

  function ProjectListItem({ p }: { p: Project }) {
    return (
      <div className="list-item">
        <span className={`badge ${p.is_open_source?'badge-open':'badge-closed'}`} style={{flexShrink:0}}>
          {p.is_open_source?'OSS':'Closed'}
        </span>
        <div style={{flex:1,minWidth:0}}>
          <div style={{fontWeight:600,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{tl(p,lang)}</div>
          <div style={{fontSize:'.75rem',color:'var(--text3)',fontFamily:"'Space Mono',monospace"}}>
            {p.version} {p.tech_stack?'· '+p.tech_stack.split(',').slice(0,3).join(', '):''}
          </div>
        </div>
        {isAdmin&&(
          <div style={{display:'flex',gap:'.3rem',flexShrink:0}}>
            <button className="btn-icon" style={{width:26,height:26}} onClick={()=>setEditing(p)}><Pencil size={12}/></button>
            <button className="btn-icon" style={{width:26,height:26}} onClick={()=>del(p.id)}><Trash2 size={12}/></button>
          </div>
        )}
        {p.url&&(
          <a href={p.url} target="_blank" rel="noopener noreferrer" className="btn-icon" style={{width:26,height:26,flexShrink:0}}>
            {p.is_open_source?<Github size={12}/>:<Download size={12}/>}
          </a>
        )}
      </div>
    )
  }

  function renderGroup(title: string, list: Project[]) {
    if(list.length===0 && !isAdmin) return null
    return (
      <div style={{marginBottom:'2.5rem'}}>
        <h3 style={{fontSize:'.8rem',fontWeight:700,letterSpacing:'.1em',textTransform:'uppercase',color:'var(--text3)',fontFamily:"'Space Mono',monospace",marginBottom:'1rem'}}>
          {title} <span style={{color:'var(--text3)',fontWeight:400}}>({list.length})</span>
        </h3>
        {view==='card'
          ? <div className="cards-grid">{list.map(p=><ProjectCard key={p.id} p={p}/>)}{isAdmin&&<button className="add-btn" onClick={()=>setEditing('new')}><Plus size={14}/>{lang==='zh'?'添加':'Add'}</button>}</div>
          : <div className="list-view">{list.map(p=><ProjectListItem key={p.id} p={p}/>)}{isAdmin&&<button className="add-btn" style={{padding:'.6rem'}} onClick={()=>setEditing('new')}><Plus size={14}/>{lang==='zh'?'添加':'Add'}</button>}</div>
        }
      </div>
    )
  }

  return (
    <div className="page-wrap" style={{position:'relative'}}>
      <AnimBg theme="projects"/>
      <div className="page-header">
        <span className="section-label">// software</span>
        <div style={{display:'flex',alignItems:'flex-end',justifyContent:'space-between',flexWrap:'wrap',gap:'1rem'}}>
          <h1 className="section-title">{lang==='zh'?'软件项目':'Projects'}</h1>
          <div style={{display:'flex',gap:'.5rem',alignItems:'center'}}>
            <ViewToggle mode={view} onChange={setView}/>
            {isAdmin&&tab==='recommend'&&<button className="btn-primary" style={{padding:'.45rem 1rem',fontSize:'.82rem'}} onClick={()=>setEditing('new')}><Plus size={14}/>{lang==='zh'?'新增':'Add'}</button>}
          </div>
        </div>
      </div>

      <div className="sub-nav">
        <button className={`sub-nav-btn ${tab==='mine'?'active':''}`} onClick={()=>setTab('mine')}>
          {lang==='zh'?'我的作品':'My Work'}
        </button>
        <button className={`sub-nav-btn ${tab==='recommend'?'active':''}`} onClick={()=>setTab('recommend')}>
          {lang==='zh'?'软件推荐':'Recommendations'}
        </button>
      </div>

      <div style={{maxWidth:1200,margin:'0 auto',padding:'1.5rem 2rem 4rem'}}>
        {tab==='mine' ? (
          <>
            {ghStatus==='loading'&&(
              <div style={{display:'flex',alignItems:'center',gap:'.6rem',color:'var(--text3)',fontFamily:"'Space Mono',monospace",fontSize:'.82rem',padding:'2rem 0'}}>
                <Loader size={14} className="spin"/>{lang==='zh'?'正在读取 GitHub…':'Loading from GitHub…'}
              </div>
            )}
            {ghStatus==='error'&&(
              <div style={{textAlign:'center',padding:'3rem 1rem',display:'flex',flexDirection:'column',gap:'.9rem',alignItems:'center'}}>
                <div style={{color:'var(--text2)',fontSize:'.88rem'}}>
                  {lang==='zh'?'读不到 GitHub，可能是网络问题或被限流。':'Could not reach GitHub — network issue or rate limit.'}
                </div>
                <button className="btn-ghost" style={{fontSize:'.82rem'}} onClick={loadGithub}>
                  <RefreshCw size={13}/>{lang==='zh'?'重试':'Retry'}
                </button>
              </div>
            )}
            {(ghStatus==='ok'||ghStatus==='stale')&&(
              <>
                {ghStatus==='stale'&&(
                  <div style={{fontSize:'.75rem',color:'var(--text3)',fontFamily:"'Space Mono',monospace",marginBottom:'1rem'}}>
                    {lang==='zh'?'以下是缓存的数据，暂时连不上 GitHub。':'Showing cached data — GitHub is unreachable right now.'}
                  </div>
                )}
                {isAdmin&&(
                  <div style={{fontSize:'.75rem',color:'var(--text3)',marginBottom:'1.2rem'}}>
                    {lang==='zh'
                      ? '这些卡片直接读自 GitHub，没有后台编辑入口。要改展示哪些、什么顺序，编辑 src/data/projects.ts；描述和语言以 GitHub 仓库为准。'
                      : 'These cards come straight from GitHub — there is no admin editor here. Curate which repos appear (and in what order) in src/data/projects.ts; descriptions and languages follow the repos.'}
                  </div>
                )}
                {showcase.length===0 ? (
                  <div style={{textAlign:'center',padding:'4rem',color:'var(--text3)',fontFamily:"'Space Mono',monospace",fontSize:'.85rem'}}>
                    {lang==='zh'?'暂无内容':'Nothing here yet'}
                  </div>
                ) : view==='card' ? (
                  <div className="cards-grid">{showcase.map(r=><ShowcaseCard key={r.name} r={r}/>)}</div>
                ) : (
                  <div className="list-view">{showcase.map(r=><ShowcaseListItem key={r.name} r={r}/>)}</div>
                )}
              </>
            )}
          </>
        ) : (
          <>
            {renderGroup(lang==='zh'?'开源项目':'Open Source', openSource)}
            {renderGroup(lang==='zh'?'闭源项目':'Closed Source', closedSource)}
            {visible.length===0&&!isAdmin&&(
              <div style={{textAlign:'center',padding:'4rem',color:'var(--text3)',fontFamily:"'Space Mono',monospace",fontSize:'.85rem'}}>
                {lang==='zh'?'暂无内容':'Nothing here yet'}
              </div>
            )}
          </>
        )}
      </div>
      {editing!==null&&<ProjectEditor item={editing==='new'?undefined:editing} onSave={save} onClose={()=>setEditing(null)}/>}
    </div>
  )
}
