'use strict';
const $ = id => document.getElementById(id);
const paths = {
  pulse:'<path d="M2 12h5l3-7 4 14 3-7h5"/>',
  today:'<rect x="3" y="5" width="18" height="16" rx="2"/><path d="M3 10h18M8 3v4m8-4v4"/>',
  cases:'<rect x="3" y="7" width="18" height="14" rx="2"/><path d="M8 7V4h8v3m-7 7h6m-3-3v6"/>',
  check:'<rect x="4" y="4" width="16" height="16" rx="2"/><path d="m8 12 3 3 5-6"/>',
  notes:'<path d="M6 3h8l4 4v14H6zM9 12h6m-6 4h6"/>',
  review:'<path d="M5 4h14v16l-7-4-7 4z"/>',
  plus:'<path d="M12 5v14M5 12h14"/>',
  alert:'<path d="M12 3 2 20h20zM12 9v4m0 3v1"/>'
};
const icon = name => '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">'+paths[name]+'</svg>';
const h = value => String(value ?? '').replace(/[&<>"']/g, char => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));
const uid = () => crypto.randomUUID();
const now = () => new Date().toISOString();
const dateTime = value => new Intl.DateTimeFormat('pt-PT',{dateStyle:'short',timeStyle:'short',timeZone:'Europe/Lisbon'}).format(new Date(value));
const storageKey = 'gestao-casos-diaria-v1';
let data = {cases:[],review:[],templates:{}};
let storageError = false;
try {const saved = localStorage.getItem(storageKey); if(saved) data = JSON.parse(saved);}
catch {storageError = true;}
let timer;
function toast(message) { $('toast').textContent = message; clearTimeout(timer); timer = setTimeout(()=>$('toast').textContent='',4500); }
function save(message) {
  try {localStorage.setItem(storageKey, JSON.stringify(data)); storageError=false; if(message) toast(message);}
  catch {storageError=true; toast('A gravação local falhou. As alterações estão apenas nesta sessão.');}
}
const navItems = [['today','Hoje','today'],['cases','Casos','cases'],['checks','Checklists','check'],['templates','Modelos de notas','notes'],['review','Para rever','review']];
const priorities = ['Alta','Intermédia','Habitual'];
const services = ['Enfermaria','Serviço de urgência','Outro'];
const taskStates = ['Pendente','Em curso','Concluída'];
const labels = {
  evolution:'Evolução nas últimas 24 horas', observed:'Dados observados', reported:'Dados referidos',
  confirm:'Informação por confirmar', pending:'Exames pendentes', limitations:'Limitações técnicas',
  uncertainty:'Incerteza clínica', diagnostic:'Plano diagnóstico geral', therapy:'Plano terapêutico geral',
  criteria:'Critérios de reavaliação', admission:'Motivo de admissão e história breve',
  autonomy:'Autonomia e contexto basal', discharge:'Estado à alta', medication:'Medicação à alta',
  followup:'Seguimento e plano após a alta'
};
const checklists = {
  'Insuficiência cardíaca':['Rever sinais de congestão e perfusão','Rever peso, balanço hídrico e diurese','Rever função renal e ionograma','Registar resposta ao tratamento e critérios de reavaliação'],
  'Infeção / sépsis':['Rever foco suspeito, sinais vitais e disfunção orgânica','Rever colheitas, microbiologia e exames pendentes','Documentar antimicrobianos e controlo de foco','Registar resposta e momento da próxima reavaliação'],
  'DPOC':['Registar sintomas, estado respiratório e suporte habitual','Rever oxigenação, suporte atual e gasometria disponível','Rever fatores precipitantes e resposta ao tratamento','Documentar plano de vigilância e seguimento'],
  'Diabetes':['Rever perfil glicémico e episódios de hipoglicemia','Rever ingestão, função renal e terapêutica atual','Registar alterações da terapêutica e vigilância','Documentar plano de continuidade'],
  'Lesão renal aguda':['Rever creatinina basal, tendência e diurese','Rever volemia e causas possíveis','Rever medicação, exposição a nefrotóxicos e exames','Definir parâmetros e momento de reavaliação'],
  'Geriatria':['Registar funcionalidade e cognição basais','Rever delirium, mobilidade, quedas e fragilidade','Rever medicação, nutrição e apoio disponível','Documentar objetivos de cuidados e plano de continuidade'],
  'Derrame pleural':['Registar lateralidade, dimensão e repercussão','Rever imagem, evolução e etiologias em avaliação','Rever colheitas, drenagem e resultados pendentes','Documentar resposta clínica e plano de seguimento']
};
const problemFields = {title:'Problema',evolution:'Evolução do problema',diagnostic:'Plano diagnóstico',therapy:'Plano terapêutico',criteria:'Critérios de reavaliação'};
const notes = {
  'Diário clínico':'DIÁRIO CLÍNICO\n{caso}\n\nEvolução nas últimas 24 horas\n{evolution}\n\nDados observados\n{observed}\n\nDados referidos\n{reported}\n\n{problemas}\n\n{plano}\n\n{pendentes}',
  'Nota de admissão':'NOTA DE ADMISSÃO\n{caso}\n\nAutonomia e contexto basal\n{autonomy}\n\nMotivo de admissão e história breve\n{admission}\n\nDados observados\n{observed}\n\nDados referidos\n{reported}\n\n{problemas}\n\n{plano}\n\n{pendentes}',
  'Nota de alta':'NOTA DE ALTA\n{caso}\n\nAutonomia e contexto basal\n{autonomy}\n\nMotivo de admissão e história breve\n{admission}\n\nEvolução por problemas\n{problemas}\n\nExame objetivo à alta (dados observados)\n{observed}\n\nEstado à alta\n{discharge}\n\nMedicação à alta\n{medication}\n\nSeguimento e plano após a alta\n{followup}\n\n{plano}\n\n{pendentes}'
};
let page='today', currentId='', tab='daily';
const filters={priority:'',service:'',patient:'',task:''};
let comparison=['',''];
const main=$('main'), dialog=$('dialog');
const empty = (image,title,detail,action='') => '<div class="empty"><span class="empty-icon">'+icon(image)+'</span><h3>'+title+'</h3><p>'+detail+'</p>'+action+'</div>';
const btn=(label,action,style='',image='')=>'<button type="button" class="'+style+'" data-action="'+action+'">'+(image?icon(image):'')+h(label)+'</button>';
const options=(items,value='',blank)=> (blank===undefined?'':'<option value="">'+h(blank)+'</option>')+items.map(item=>{
  const [id,label]=Array.isArray(item)?item:[item,item];
  return '<option value="'+h(id)+'"'+(id===value?' selected':'')+'>'+h(label)+'</option>';
}).join('');
const select=(name,label,items,value,blank)=>'<label>'+h(label)+'<select name="'+h(name)+'">'+options(items,value,blank)+'</select></label>';
const field=(name,label,value='',config={})=>'<label class="'+(config.wide?'wide':'')+'">'+h(label)+(config.textarea?'<textarea name="'+name+'" '+(config.required?'required':'')+'>'+h(value)+'</textarea>':'<input name="'+name+'" value="'+h(value)+'" '+(config.required?'required':'')+' maxlength="140">')+'</label>';
const panel=(title,body,subtitle='',actions='')=>'<section class="panel"><div class="panel-head"><div><h2>'+h(title)+'</h2>'+(subtitle?'<p>'+h(subtitle)+'</p>':'')+'</div>'+actions+'</div>'+body+'</section>';
const hero=(title,subtitle,actions='')=>'<section class="hero"><div><h1>'+h(title)+'</h1><p>'+h(subtitle)+'</p></div>'+(actions?'<div class="actions">'+actions+'</div>':'')+'</section>';
const caseById=id=>data.cases.find(c=>c.id===id);
const openCase=(id,next='daily')=>{currentId=id; page='case'; tab=next; comparison=['','']; render(); window.scrollTo(0,0);};
function modal(title,body,submit,callback) {
  dialog.innerHTML='<h2 id="dialog-title">'+h(title)+'</h2><form><div class="fields">'+body+'</div><div class="actions">'+btn('Cancelar','cancel')+'<button class="primary">'+h(submit)+'</button></div></form>';
  dialog.querySelector('form').addEventListener('submit',event=>{
    event.preventDefault();
    const values=Object.fromEntries(new FormData(event.currentTarget));
    for(const key of Object.keys(values)) values[key]=values[key].trim();
    if ([...event.currentTarget.querySelectorAll('[required]')].some(input=>!input.value.trim())) {toast('Preencha os campos obrigatórios.');return;}
    dialog.close(); callback(values);
  });
  dialog.showModal();
}
function caseEditor(existing) {
  modal(existing?'Editar identificação':'Novo caso',
    '<p class="hint wide">Use um código ou pseudónimo e evite dados que permitam identificar o doente.</p>'+
    field('name','Código ou pseudónimo',existing?.name,{required:true,wide:true})+
    select('service','Serviço',services,existing?.service)+select('priority','Prioridade',priorities,existing?.priority??'Habitual'),
    existing?'Guardar':'Criar caso', values=>{
      if(existing) Object.assign(existing,values);
      else {existing={...values,id:uid(),created:now(),fields:{},problems:[],tasks:[],events:[],assessments:[],checks:{},drafts:{},archived:false};data.cases.push(existing);}
      save('Caso guardado.');openCase(existing.id);
    });
}
function caseRow(c) {
  const pending=c.tasks.filter(t=>t.state!=='Concluída').length;
  return '<article class="item row between"><div><h3>'+h(c.name)+'</h3><div class="row"><span class="badge '+c.priority.toLowerCase()+'">'+h(c.priority)+'</span><span class="muted">'+h(c.service)+' · '+pending+' tarefa(s) em aberto'+(c.archived?' · Arquivado':'')+'</span></div></div>'+btn('Abrir caso','open:'+c.id,'ghost')+'</article>';
}
function taskRow(task,c,showCase=false) {
  return '<article class="item row between"><div><h3>'+h(task.title)+'</h3>'+(showCase?btn(c.name,'open-tasks:'+c.id,'ghost'):'')+'<p>'+h(task.detail)+'</p></div><div class="row">'+select('task:'+c.id+':'+task.id,'Estado',taskStates,task.state)+btn('Editar','task-edit:'+c.id+':'+task.id,'ghost')+'</div></article>';
}
function todayView() {
  const active=data.cases.filter(c=>!c.archived);
  const byPriority=(a,b)=>priorities.indexOf(a.priority)-priorities.indexOf(b.priority);
  const base=active.filter(c=>(!filters.priority||c.priority===filters.priority)&&(!filters.service||c.service===filters.service)&&(!filters.patient||c.id===filters.patient)).sort(byPriority);
  const visible=base.filter(c=>!filters.task||c.tasks.some(t=>t.state===filters.task));
  const tasks=visible.flatMap(c=>c.tasks.filter(t=>filters.task?t.state===filters.task:t.state!=='Concluída').map(t=>taskRow(t,c,true)));
  const stats=[['Casos ativos',active.length,'cases'],['Prioridade alta',active.filter(c=>c.priority==='Alta').length,'alert'],['Tarefas em aberto',active.flatMap(c=>c.tasks).filter(t=>t.state!=='Concluída').length,'check'],['Para rever',data.review.filter(r=>!r.done).length,'review']];
  return hero('Hoje','Organize a revisão por doente, acompanhe os pendentes e prepare as notas do dia.',btn('Novo caso','new','primary','plus'))+
    '<div class="stats">'+stats.map(([name,num,image])=>'<article class="stat"><span>'+name+'</span><strong>'+num+'</strong><i>'+icon(image)+'</i></article>').join('')+'</div>'+
    '<div class="dashboard">'+panel('Revisão por doente',
      '<div class="filters">'+select('filter:priority','Prioridade',priorities,filters.priority,'Todas')+select('filter:service','Serviço',services,filters.service,'Todos')+
      select('filter:patient','Doente',active.map(c=>[c.id,c.name]),filters.patient,'Todos')+select('filter:task','Estado da tarefa',taskStates,filters.task,'Todos')+'</div>'+
      (visible.length?visible.map(caseRow).join(''):active.length?empty('cases','Nenhum caso com estes filtros','Altere os filtros para ver outros casos.',btn('Limpar filtros','reset-filters')):empty('cases','Ainda sem casos ativos','Crie um caso para começar a revisão clínica.',btn('Criar primeiro caso','new','primary','plus'))),
      '',Object.values(filters).some(Boolean)?btn('Limpar filtros','reset-filters','ghost'):'')+
    panel('Tarefas',tasks.join('')||empty('check','Sem tarefas nesta vista','As tarefas dos casos aparecem aqui de acordo com os filtros.'))+'</div>';
}
function assessmentFields(keys,values) {return keys.map(key=>field(key,labels[key],values[key],{textarea:true})).join('');}
function dailyView(c) {
  const form=(title,keys)=>panel(title,'<form data-form="daily"><div class="fields">'+assessmentFields(keys,c.fields)+'</div><div class="actions" style="margin-top:12px"><button class="primary">Guardar alterações</button></div></form>');
  return panel('Lista de problemas',c.problems.length?c.problems.map((p,i)=>'<article class="item"><div class="row between"><h3>'+String(i+1)+'. '+h(p.title)+'</h3>'+btn('Editar','problem:'+p.id,'ghost')+'</div>'+
    Object.keys(problemFields).slice(1).map(key=>'<p><strong>'+h(problemFields[key])+'</strong> · '+h(p[key]||'[Por preencher]')+'</p>').join('')+'</article>').join(''):'<p>Adicione os problemas ativos e registe o plano de cada um.</p>','',btn('Adicionar problema','problem','', 'plus'))+
    form('Revisão clínica',['evolution','observed','reported','confirm','pending','limitations','uncertainty'])+
    form('Plano geral e reavaliação',['diagnostic','therapy','criteria'])+
    form('Admissão e alta',['admission','autonomy','discharge','medication','followup']);
}
function checklistView(c) {
  return '<p class="hint">As listas servem para organizar a revisão. Assinale cada ponto após o rever.</p><div class="cards">'+Object.entries(checklists).map(([name,items],i)=>
    panel(name,c?.checks[name]?items.map((item,j)=>'<label class="check"><input type="checkbox" name="check:'+i+':'+j+'" '+(c.checks[name][j]?'checked':'')+'>'+h(item)+'</label>').join(''):
      '<ul>'+items.map(item=>'<li>'+h(item)+'</li>').join('')+'</ul>','',c&&!c.checks[name]?btn('Aplicar ao caso','apply-check:'+i):'')).join('')+'</div>';
}
function snapshot(c) {
  const values={};
  for(const [key,label] of Object.entries(labels)) values[label]=c.fields[key]||'';
  values['Lista de problemas']=problemText(c);
  return values;
}
const problemText=c=>c.problems.map((p,i)=>String(i+1)+'. '+p.title+'\n'+Object.keys(problemFields).slice(1).map(key=>problemFields[key]+' · '+(p[key]||'[Por preencher]')).join('\n')).join('\n\n');
function historyView(c) {
  const entries=c.events.slice().reverse().map(e=>'<article class="item"><small class="muted">'+dateTime(e.at)+'</small><h3>'+h(e.decision)+'</h3><p><strong>Resposta / evolução</strong> · '+h(e.response||'[Por registar]')+'</p>'+(e.responseAt?'<small class="muted">Resposta atualizada em '+dateTime(e.responseAt)+'</small><br>':'')+btn('Editar','event:'+e.id,'ghost')+'</article>').join('');
  const snapshots=c.assessments.slice().reverse();
  const assessmentOptions=snapshots.map(a=>[a.id,dateTime(a.at)+' · '+a.name]);
  const [before,after]=comparison.map(id=>snapshots.find(a=>a.id===id));
  const comparisonBody=before&&after?'<table class="comparison"><thead><tr><th>Campo</th><th>'+h(before.name)+'</th><th>'+h(after.name)+'</th></tr></thead><tbody>'+
    Object.keys(before.values).map(key=>'<tr class="'+(before.values[key]!==after.values[key]?'changed':'')+'"><th scope="row">'+h(key)+'</th><td>'+h(before.values[key]||'[Por preencher]')+'</td><td>'+h(after.values[key]||'[Por preencher]')+'</td></tr>').join('')+'</tbody></table>':'';
  return panel('Decisões e resposta ao tratamento',entries||'<p>Ainda sem decisões registadas.</p>','',btn('Registar decisão','event','', 'plus'))+
    panel('Avaliações guardadas',snapshots.length?snapshots.map(a=>'<details class="item"><summary>'+h(a.name)+' · '+dateTime(a.at)+'</summary>'+Object.entries(a.values).filter(([,v])=>v).map(([key,value])=>'<p><strong>'+h(key)+'</strong> · '+h(value)+'</p>').join('')+'</details>').join(''):'<p>Guarde uma cópia da revisão clínica para a consultar e comparar mais tarde.</p>','',btn('Guardar avaliação','snapshot','primary'))+
    (snapshots.length>=2?panel('Comparar avaliações','<div class="fields">'+select('compare:0','Avaliação A',assessmentOptions,comparison[0],'Selecionar')+select('compare:1','Avaliação B',assessmentOptions,comparison[1],'Selecionar')+'</div>'+comparisonBody,'As linhas com alterações ficam destacadas.'):'' );
}
function generate(c,type) {
  const values=Object.fromEntries(Object.keys(labels).map(key=>[key,c.fields[key]||'[Por preencher]']));
  values.caso='Código: '+c.name+'\nServiço: '+c.service;
  values.problemas='LISTA DE PROBLEMAS E PLANO\n'+(problemText(c)||'[Por preencher]');
  values.plano='PLANO GERAL\n'+['diagnostic','therapy','criteria'].map(key=>labels[key]+' · '+values[key]).join('\n');
  values.pendentes='PENDENTES E INCERTEZA\n'+['pending','confirm','limitations','uncertainty'].map(key=>labels[key]+' · '+values[key]).join('\n')+
    (c.tasks.some(t=>t.state!=='Concluída')?'\nTarefas em aberto\n'+c.tasks.filter(t=>t.state!=='Concluída').map(t=>'- '+t.title+' ('+t.state+')'+(t.detail?' · '+t.detail:'')).join('\n'):'');
  return (data.templates[type]??notes[type]).replace(/\{([a-z]+)\}/g,(match,key)=>values[key]??match);
}
function noteView(c) {
  return '<p class="hint">Os rascunhos usam os campos guardados do caso. Reveja o texto e os campos por preencher antes de o copiar.</p>'+
    Object.keys(notes).map(type=>panel(type,'<form data-form="draft" data-type="'+h(type)+'">'+field('text','Rascunho editável',c.drafts[type]??'',{textarea:true})+
    '<div class="actions" style="margin-top:12px">'+btn('Gerar a partir do caso','generate:'+type)+
    '<button class="primary">Guardar rascunho</button>'+btn('Copiar texto','copy','ghost')+'</div></form>')).join('');
}
function templatesView() {
  const keys=['caso','problemas','plano','pendentes',...Object.keys(labels)];
  return hero('Modelos de notas','Edite a estrutura reutilizável dos diários clínicos, admissões e altas.')+
    '<details class="panel"><summary>Campos disponíveis para inserir</summary><div class="stack" style="margin-top:12px">'+keys.map(key=>'<div><code>{'+h(key)+'}</code> · '+h(labels[key]??{caso:'Código e serviço',problemas:'Lista de problemas e plano por problema',plano:'Plano geral e critérios de reavaliação',pendentes:'Pendentes, incerteza e limitações'}[key])+'</div>').join('')+'</div></details>'+
    Object.keys(notes).map(type=>panel(type,'<form data-form="template" data-type="'+h(type)+'">'+field('text','Estrutura do modelo',data.templates[type]??notes[type],{textarea:true,required:true})+
      '<div class="actions" style="margin-top:12px"><button class="primary">Guardar modelo</button>'+btn('Repor modelo inicial','restore:'+type,'ghost')+'</div></form>')).join('');
}
function reviewView() {
  const content=data.review.slice().sort((a,b)=>Number(a.done)-Number(b.done)).map(r=>'<article class="item"><div class="row between"><h3>'+h(r.title)+'</h3><span class="badge '+(r.done?'done':'')+'">'+(r.done?'Revisto':'Por rever')+'</span></div><p>'+h(r.text)+'</p><div class="actions">'+
    (r.caseId?btn('Abrir '+(caseById(r.caseId)?.name??'caso'),'open:'+r.caseId,'ghost'):'')+
    btn('Editar','review-edit:'+r.id,'ghost')+btn(r.done?'Reabrir':'Marcar como revisto','review-toggle:'+r.id)+'</div></article>').join('');
  return hero('Para rever','Guarde casos complexos e dúvidas para retomar mais tarde.',btn('Adicionar à revisão','review-new','primary','plus'))+
    panel('Fila de revisão',content||empty('review','Fila de revisão vazia','Adicione uma dúvida ou sinalize um caso a partir da sua ficha.'));
}
const tabs=[['daily','Revisão clínica'],['tasks','Tarefas'],['checklists','Checklists'],['history','Cronologia e avaliações'],['notes','Preparar notas']];
function caseView(c) {
  const views={daily:()=>dailyView(c),tasks:()=>panel('Tarefas do caso',c.tasks.map(t=>taskRow(t,c)).join('')||'<p>Ainda sem tarefas.</p>','',btn('Nova tarefa','task-new','primary','plus')),checklists:()=>checklistView(c),history:()=>historyView(c),notes:()=>noteView(c)};
  return hero(c.name,c.service+' · Prioridade '+c.priority.toLowerCase()+(c.archived?' · Arquivado':''),btn('Editar caso','edit')+btn('Guardar para rever','review-case','primary','review'))+
    '<div class="row between tabs"><div class="row">'+tabs.map(([key,label])=>'<button data-action="tab:'+key+'" aria-current="'+(key===tab)+'">'+h(label)+'</button>').join('')+'</div><details><summary>Mais ações</summary><div class="actions" style="margin-top:8px">'+btn('Reutilizar estrutura','duplicate')+btn(c.archived?'Reativar caso':'Arquivar caso','archive')+'</div></details></div>'+views[tab]();
}
function render() {
  const c=caseById(currentId);
  const links=navItems.map(([key,label,image])=>'<button type="button" data-action="nav:'+key+'" '+((page===key||(page==='case'&&key==='cases'))?'aria-current="page"':'')+'>'+icon(image)+h(label)+'</button>');
  $('nav').innerHTML=links.join('');
  $('location').textContent=page==='case'?c?.name:navItems.find(item=>item[0]===page)?.[1];
  const views={today:todayView,cases:()=>hero('Casos','Consulte casos ativos e arquivados.',btn('Novo caso','new','primary','plus'))+panel('Ativos',data.cases.filter(x=>!x.archived).map(caseRow).join('')||'<p>Sem casos ativos.</p>')+panel('Arquivados',data.cases.filter(x=>x.archived).map(caseRow).join('')||'<p>Sem casos arquivados.</p>'),case:()=>caseView(c),checks:()=>hero('Checklists clínicas','Aplique listas de revisão a partir da ficha de cada caso.')+checklistView(),templates:templatesView,review:reviewView};
  main.innerHTML=(storageError?'<p class="hint" role="alert">O armazenamento local está indisponível. Verifique as definições do navegador.</p>':'')+views[page]();
}
function taskEditor(c,task) {
  modal(task?'Editar tarefa':'Nova tarefa',
    field('title','Tarefa',task?.title,{required:true,wide:true})+
    field('detail','Detalhes e prazo',task?.detail,{textarea:true,wide:true})+
    select('state','Estado',taskStates,task?.state), 'Guardar tarefa',values=>{
      if(task) Object.assign(task,values);
      else c.tasks.push({...values,id:uid()});
      save('Tarefa guardada.');render();
    });
}
function reviewEditor(c,entry) {
  modal(entry?'Editar revisão':'Adicionar à revisão',field('title','Título',entry?.title??c?.name,{required:true,wide:true})+
    select('caseId','Caso associado',data.cases.map(x=>[x.id,x.name]),entry?.caseId??c?.id,'Sem caso associado')+
    field('text','Questão ou pontos a rever',entry?.text,{textarea:true,wide:true}), 'Guardar para rever', values=>{
      if(entry) Object.assign(entry,values);
      else data.review.push({...values,id:uid(),done:false});
      save('Entrada guardada na fila de revisão.');render();
    });
}
document.addEventListener('click',async event=>{
  const target=event.target.closest('[data-action]');
  if(!target)return;
  const [action,arg,id]=target.dataset.action.split(':');
  const c=caseById(currentId);
  switch(action) {
    case 'cancel': dialog.close();break;
    case 'nav': page=arg;render();window.scrollTo(0,0);break;
    case 'tab': tab=arg;render();break;
    case 'new': caseEditor();break;
    case 'edit': caseEditor(c);break;
    case 'open': openCase(arg);break;
    case 'open-tasks': openCase(arg,'tasks');break;
    case 'reset-filters': Object.keys(filters).forEach(key=>filters[key]='');render();break;
    case 'task-new': taskEditor(c);break;
    case 'task-edit': {const owner=caseById(arg);taskEditor(owner,owner.tasks.find(t=>t.id===id));break;}
    case 'problem': {
      const problem=c.problems.find(p=>p.id===arg);
      modal(problem?'Editar problema':'Adicionar problema',Object.entries(problemFields).map(([key,label])=>field(key,label,problem?.[key],{required:key==='title',textarea:key!=='title',wide:key==='title'})).join(''),'Guardar problema',values=>{
        if(problem) Object.assign(problem,values);
        else c.problems.push({...values,id:uid()});
        save('Problema guardado.');render();
      });break;
    }
    case 'apply-check': {
      const [name,items]=Object.entries(checklists)[Number(arg)];
      c.checks[name]=items.map(()=>false);save('Checklist aplicada.');render();break;
    }
    case 'event': {
      const item=c.events.find(e=>e.id===arg);
      modal(item?'Editar decisão e resposta':'Registar decisão',field('decision','Decisão',item?.decision,{required:true,textarea:true,wide:true})+
        field('response','Resposta ao tratamento ou evolução',item?.response,{textarea:true,wide:true}),'Guardar decisão',values=>{
          if(item) {
            if(item.response!==values.response) item.responseAt=now();
            Object.assign(item,values);
          } else c.events.push({...values,id:uid(),at:now(),responseAt:values.response?now():''});
          save('Decisão guardada.');render();
        });break;
    }
    case 'snapshot':
      modal('Guardar avaliação',field('name','Título da avaliação','Reavaliação',{required:true,wide:true}),'Guardar avaliação',values=>{
        const assessment={...values,id:uid(),at:now(),values:snapshot(c)};
        comparison=[c.assessments.at(-1)?.id??'',assessment.id];
        c.assessments.push(assessment);save('Avaliação guardada.');render();
      });break;
    case 'review-new': reviewEditor();break;
    case 'review-case': reviewEditor(c);break;
    case 'review-edit': reviewEditor(undefined,data.review.find(r=>r.id===arg));break;
    case 'review-toggle': {
      const entry=data.review.find(r=>r.id===arg);entry.done=!entry.done;save(entry.done?'Marcado como revisto.':'Reaberto para revisão.');render();break;
    }
    case 'archive':
      c.archived=!c.archived;
      if(c.archived&&filters.patient===c.id) filters.patient='';
      save(c.archived?'Caso arquivado.':'Caso reativado.');render();break;
    case 'duplicate':
      modal('Reutilizar estrutura do caso','<p class="hint wide">A nova ficha herda o serviço e as checklists, por assinalar. Use a opção abaixo se quiser reaproveitar também os títulos dos problemas. Os registos clínicos da ficha nova começam em branco.</p>'+
        field('name','Código ou pseudónimo do novo caso','',{required:true,wide:true})+
        '<label class="check wide"><input type="checkbox" name="problemTitles" value="sim">Reutilizar os títulos dos problemas</label>', 'Criar novo caso',values=>{
          const copy={id:uid(),name:values.name,service:c.service,priority:'Habitual',created:now(),fields:{},
            problems:values.problemTitles?c.problems.map(p=>({id:uid(),title:p.title})):[],tasks:[],events:[],assessments:[],
            checks:Object.fromEntries(Object.entries(c.checks).map(([name,items])=>[name,items.map(()=>false)])),drafts:{},archived:false};
          data.cases.push(copy);save('Novo caso criado.');openCase(copy.id);
        });break;
    case 'generate': {
      const editor=target.closest('form').elements.text;
      const replace=()=>{editor.value=generate(c,arg);c.drafts[arg]=editor.value;save('Rascunho gerado.');};
      if(editor.value.trim()) modal('Gerar novo rascunho','<p class="wide">O texto gerado vai substituir o rascunho atual.</p>','Substituir rascunho',replace);
      else replace();
      break;
    }
    case 'copy': {
      const input=target.closest('form').elements.text;
      if(!input.value.trim()){toast('Escreva ou gere um rascunho primeiro.');break;}
      try {await navigator.clipboard.writeText(input.value);toast('Texto copiado.');}
      catch {input.focus();input.select();toast('Texto selecionado para cópia manual.');}
      break;
    }
    case 'restore':
      modal('Repor modelo inicial','<p class="wide">A estrutura inicial vai substituir o modelo editado.</p>','Repor modelo',()=>{
        delete data.templates[arg];save('Modelo inicial reposto.');render();
      });break;
  }
});
main.addEventListener('change',event=>{
  const {name,value,checked}=event.target;
  if(!name)return;
  const [kind,first,second]=name.split(':');
  const c=caseById(currentId);
  switch(kind) {
    case 'filter': filters[first]=value;render();main.querySelector('[name="'+name+'"]')?.focus();break;
    case 'task': {
      const task=caseById(first).tasks.find(t=>t.id===second);
      task.state=value;save('Estado atualizado.');render();main.querySelector('[name="'+name+'"]')?.focus();break;
    }
    case 'check': c.checks[Object.keys(checklists)[Number(first)]][Number(second)]=checked;save();break;
    case 'compare': comparison[Number(first)]=value;render();main.querySelector('[name="'+name+'"]')?.focus();break;
  }
});
main.addEventListener('input',event=>{
  const form=event.target.closest('form[data-form]');
  if(!form)return;
  const c=caseById(currentId);
  if(form.dataset.form==='daily') c.fields[event.target.name]=event.target.value;
  else if(form.dataset.form==='draft') c.drafts[form.dataset.type]=event.target.value;
  else if(form.dataset.form==='template') return;
  save();
});
main.addEventListener('submit',event=>{
  const form=event.target;
  const c=caseById(currentId);
  event.preventDefault();
  if(form.dataset.form==='daily') Object.assign(c.fields,Object.fromEntries(new FormData(form)));
  if(form.dataset.form==='draft') c.drafts[form.dataset.type]=form.elements.text.value;
  if(form.dataset.form==='template'){
    const value=form.elements.text.value;
    if(!value.trim()){toast('Preencha a estrutura do modelo.');return;}
    data.templates[form.dataset.type]=value;
  }
  save('Alterações guardadas.');
});
$('logo').innerHTML=icon('pulse');
$('date').textContent=new Intl.DateTimeFormat('pt-PT',{dateStyle:'full',timeZone:'Europe/Lisbon'}).format(new Date());
render();
