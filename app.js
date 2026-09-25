const $=id=>document.getElementById(id);
const KEY='academia_v1_data';
let data=JSON.parse(localStorage.getItem(KEY)||'{"alunos":[],"pagamentos":[]}');
const today=new Date();
function save(){localStorage.setItem(KEY,JSON.stringify(data));}
function money(v){return Number(v||0).toLocaleString('pt-BR',{style:'currency',currency:'BRL'});}
function monthKey(d=new Date()){return d.toISOString().slice(0,7);}
function formatDate(s){if(!s)return'';return new Date(s+'T12:00:00').toLocaleDateString('pt-BR');}
function aluno(id){return data.alunos.find(a=>a.id===id);}
function login(){
  if($('loginUser').value==='admin' && $('loginPass').value==='1234'){
    $('login').classList.add('hidden'); $('app').classList.remove('hidden'); renderAll();
  }else alert('Usuário ou senha incorretos.');
}
$('loginBtn').onclick=login;
$('loginPass').addEventListener('keydown',e=>{if(e.key==='Enter')login()});
$('logoutBtn').onclick=()=>{location.reload()};
$('today').textContent=new Date().toLocaleDateString('pt-BR',{dateStyle:'full'});

document.querySelectorAll('.tab').forEach(b=>b.onclick=()=>{
 document.querySelectorAll('.tab').forEach(x=>x.classList.remove('active'));
 document.querySelectorAll('.panel').forEach(x=>x.classList.remove('active'));
 b.classList.add('active'); $(b.dataset.tab).classList.add('active');
 if(b.dataset.tab==='pagamentos') renderPagamentos();
});

function renderAll(){renderDashboard();renderAlunos();renderPagamentos();populatePagAluno();}

function renderDashboard(){
 const ativos=data.alunos.filter(a=>a.status!=='Inativo');
 const m=monthKey();
 const previsto=ativos.reduce((s,a)=>s+Number(a.mensalidade||0),0);
 const pays=data.pagamentos.filter(p=>p.mes===m);
 const recebido=pays.reduce((s,p)=>s+Number(p.valor||0),0);
 const pagoIds=new Set(pays.map(p=>p.alunoId));
 const atrasados=ativos.filter(a=>!pagoIds.has(a.id) && new Date().getDate()>Number(a.vencimento||31)).length;
 const antecipados=pays.filter(p=>p.antecipado==='Sim').length;
 $('mAlunos').textContent=ativos.length;
 $('mPrevisto').textContent=money(previsto);
 $('mRecebido').textContent=money(recebido);
 $('mAberto').textContent=money(Math.max(0,previsto-recebido));
 $('mAtrasados').textContent=atrasados;
 $('mAntecipados').textContent=antecipados;
 $('resumo').textContent=`Mês atual: ${new Date().toLocaleDateString('pt-BR',{month:'long',year:'numeric'})}.`;
 $('alertas').innerHTML=atrasados?`<div class="alert">⚠️ Existem ${atrasados} aluno(s) com mensalidade aparentemente atrasada.</div>`:'<div class="alert">✅ Nenhum atraso aparente com base nos lançamentos.</div>';
}

function renderAlunos(filter=''){
 const body=$('alunosBody'); body.innerHTML='';
 data.alunos.filter(a=>(a.nome+' '+(a.telefone||'')).toLowerCase().includes(filter.toLowerCase())).forEach(a=>{
  const tr=document.createElement('tr');
  tr.innerHTML=`<td>${esc(a.nome)}</td><td>${esc(a.telefone||'')}</td><td>${money(a.mensalidade)}</td><td>Dia ${a.vencimento}</td><td><span class="badge ${a.status==='Ativo'?'ok':'warn'}">${a.status}</span></td><td><button onclick="toggleAluno('${a.id}')">${a.status==='Ativo'?'Inativar':'Ativar'}</button></td>`;
  body.appendChild(tr);
 });
}
$('buscaAluno').oninput=e=>renderAlunos(e.target.value);
function toggleAluno(id){let a=aluno(id);a.status=a.status==='Ativo'?'Inativo':'Ativo';save();renderAll();}

$('novoAlunoBtn').onclick=()=>{$('modal').classList.remove('hidden');$('nome').focus()};
$('closeModal').onclick=()=>{$('modal').classList.add('hidden')};
$('alunoForm').onsubmit=e=>{
 e.preventDefault();
 data.alunos.push({id:crypto.randomUUID(),nome:$('nome').value.trim(),telefone:$('telefone').value.trim(),mensalidade:Number($('mensalidade').value),vencimento:Number($('vencimento').value),status:'Ativo'});
 save();e.target.reset();$('modal').classList.add('hidden');renderAll();
};

function populatePagAluno(){
 $('pagAluno').innerHTML='<option value="">Selecione...</option>';
 data.alunos.filter(a=>a.status==='Ativo').forEach(a=>{let o=document.createElement('option');o.value=a.id;o.textContent=a.nome;$('pagAluno').appendChild(o)});
}
$('pagAluno').onchange=()=>{let a=aluno($('pagAluno').value);if(a)$('pagValor').value=a.mensalidade};

$('pagForm').onsubmit=e=>{
 e.preventDefault();
 const id=$('pagAluno').value;if(!id)return;
 data.pagamentos.unshift({id:crypto.randomUUID(),alunoId:id,mes:$('pagMes').value,valor:Number($('pagValor').value),data:$('pagData').value,forma:$('pagForma').value,antecipado:$('pagAnt').value,obs:$('pagObs').value,registradoEm:new Date().toISOString()});
 save();e.target.reset();$('pagData').value=new Date().toISOString().slice(0,10);renderAll();alert('Pagamento registrado com sucesso.');
};
$('pagMes').value=monthKey();$('pagData').value=new Date().toISOString().slice(0,10);

function renderPagamentos(){
 const body=$('pagBody');body.innerHTML='';
 data.pagamentos.slice(0,50).forEach(p=>{
  const a=aluno(p.alunoId)||{nome:'Aluno removido'};
  const tr=document.createElement('tr');
  tr.innerHTML=`<td>${formatDate(p.data)}</td><td>${esc(a.nome)}</td><td>${p.mes}</td><td>${money(p.valor)}</td><td>${esc(p.forma)}</td><td>${new Date(p.registradoEm).toLocaleString('pt-BR')}</td>`;
  body.appendChild(tr);
 });
}
function esc(s){return String(s??'').replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[m]));}

// Demo data buttonless seed: start empty to let the owner enter real data.
