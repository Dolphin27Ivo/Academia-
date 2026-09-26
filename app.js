const SUPABASE_URL = 'https://shmkczisodmowazppteb.supabase.co';
const SUPABASE_KEY = 'sb_publishable_c3OKLXg7KKfE8O2hW-cdQw_LYbncxsB';

const db = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);
const $=id=>document.getElementById(id);
let data = {
  alunos: [],
  pagamentos: []
};
const today=new Date();
async function carregarDados(){
  const { data: alunos, error: erroAlunos } = await db
    .from('alunos')
    .select('*')
    .order('created_at', { ascending: true });

  if (erroAlunos) {
    console.error('Erro ao carregar alunos:', erroAlunos);
    alert('Erro ao carregar os alunos do banco.');
    return;
  }

  const { data: pagamentos, error: erroPagamentos } = await db
    .from('pagamentos')
    .select('*')
    .order('created_at', { ascending: false });

  if (erroPagamentos) {
    console.error('Erro ao carregar pagamentos:', erroPagamentos);
    alert('Erro ao carregar os pagamentos do banco.');
    return;
  }

  data.alunos = alunos || [];
  data.pagamentos = pagamentos || [];

  renderAll();
}
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
function renderDashboard() {
  const ativos = data.alunos.filter(a => a.ativo === true);

  const mesAtual = new Date().toISOString().slice(0, 7);

  const previsto = ativos.reduce(
    (total, aluno) => total + Number(aluno.valor_mensal || 0),
    0
  );

  const pagamentosMes = data.pagamentos.filter(p => {
    return p.data_pagamento &&
           p.data_pagamento.slice(0, 7) === mesAtual;
  });

  const recebido = pagamentosMes.reduce(
    (total, pagamento) => total + Number(pagamento.valor || 0),
    0
  );

  const alunosPagaram = new Set(
    pagamentosMes.map(p => p.aluno_id)
  );

  const atrasados = ativos.filter(
    aluno => !alunosPagaram.has(aluno.id)
  ).length;

  $('mAlunos').textContent = ativos.length;
  $('mPrevisto').textContent = money(previsto);
  $('mRecebido').textContent = money(recebido);
  $('mAberto').textContent =
    money(Math.max(0, previsto - recebido));
  $('mAtrasados').textContent = atrasados;
  $('mAntecipados').textContent = 0;

  $('resumo').textContent =
    `Mês atual: ${new Date().toLocaleDateString('pt-BR', {
      month: 'long',
      year: 'numeric'
    })}.`;

  $('alertas').innerHTML = atrasados
    ? `<div class="alert">⚠️ Existem ${atrasados} aluno(s) sem pagamento registrado neste mês.</div>`
    : `<div class="alert">✅ Nenhum aluno sem pagamento registrado neste mês.</div>`;
}
function renderAlunos(filter = '') {
  const body = $('alunosBody');
  body.innerHTML = '';

  data.alunos
    .filter(a =>
      (a.nome + ' ' + (a.telefone || ''))
        .toLowerCase()
        .includes(filter.toLowerCase())
    )
    .forEach(a => {
      const tr = document.createElement('tr');

      tr.innerHTML = `
        <td>${esc(a.nome)}</td>
        <td>${esc(a.telefone || '')}</td>
        <td>${money(a.valor_mensal)}</td>
        <td>${a.plano || '-'}</td>
        <td>
          <span class="badge ${a.ativo ? 'ok' : 'warn'}">
            ${a.ativo ? 'Ativo' : 'Inativo'}
          </span>
        </td>
        <td>
          <button onclick="toggleAluno('${a.id}')">
            ${a.ativo ? 'Inativar' : 'Ativar'}
          </button>
        </td>
      `;

      body.appendChild(tr);
    });
}
$('buscaAluno').oninput=e=>renderAlunos(e.target.value);
async function toggleAluno(id) {
  const alunoAtual = data.alunos.find(a => a.id === id);

  if (!alunoAtual) return;

  const novoStatus = !alunoAtual.ativo;

  const { data: alunoAtualizado, error } = await db
    .from('alunos')
    .update({ ativo: novoStatus })
    .eq('id', id)
    .select()
    .single();

  if (error) {
    console.error('Erro ao atualizar aluno:', error);
    alert('Erro ao atualizar aluno: ' + error.message);
    return;
  }

  const indice = data.alunos.findIndex(a => a.id === id);
  data.alunos[indice] = alunoAtualizado;

  renderAll();
}

$('novoAlunoBtn').onclick=()=>{$('modal').classList.remove('hidden');$('nome').focus()};
$('closeModal').onclick=()=>{$('modal').classList.add('hidden')};
$('alunoForm').onsubmit = async e => {
  e.preventDefault();

  const aluno = {
    nome: $('nome').value.trim(),
    telefone: $('telefone').value.trim(),
    valor_mensal: Number($('mensalidade').value),
    ativo: true
  };

  const { data: novoAluno, error } = await db
    .from('alunos')
    .insert(aluno)
    .select()
    .single();

  if (error) {
    console.error('Erro ao cadastrar aluno:', error);
    alert('Erro ao cadastrar aluno: ' + error.message);
    return;
  }

  data.alunos.push(novoAluno);

  e.target.reset();
  $('modal').classList.add('hidden');

  renderAll();

  alert('Aluno cadastrado com sucesso!');
};

function populatePagAluno(){
 $('pagAluno').innerHTML='<option value="">Selecione...</option>';
 data.alunos.filter(a=>a.status==='Ativo').forEach(a=>{let o=document.createElement('option');o.value=a.id;o.textContent=a.nome;$('pagAluno').appendChild(o)});
}
$('pagAluno').onchange=()=>{let a=aluno($('pagAluno').value);if(a)$('pagValor').value=a.mensalidade};

$('pagForm').onsubmit = async e => {
  e.preventDefault();

  const alunoId = $('pagAluno').value;

  if (!alunoId) {
    alert('Selecione um aluno.');
    return;
  }

  const pagamento = {
    aluno_id: alunoId,
    valor: Number($('pagValor').value),
    data_pagamento: $('pagData').value,
    data_vencimento: $('pagMes').value + '-01',
    forma_pagamento: $('pagForma').value,
    observacao: $('pagObs').value.trim()
  };

  const { data: novoPagamento, error } = await db
    .from('pagamentos')
    .insert(pagamento)
    .select()
    .single();

  if (error) {
    console.error('Erro ao registrar pagamento:', error);
    alert('Erro ao registrar pagamento: ' + error.message);
    return;
  }

  data.pagamentos.unshift(novoPagamento);

  e.target.reset();

  $('pagMes').value = new Date().toISOString().slice(0, 7);
  $('pagData').value = new Date().toISOString().slice(0, 10);

  renderAll();

  alert('Pagamento registrado com sucesso!');
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
carregarDados();
