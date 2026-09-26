const SUPABASE_URL = 'https://shmkczisodmowazppteb.supabase.co';
const SUPABASE_KEY = 'sb_publishable_c3OKLXg7KKfE8O2hW-cdQw_LYbncxsB';

const db = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

const $ = id => document.getElementById(id);

let data = {
  alunos: [],
  pagamentos: []
};

function money(v) {
  return Number(v || 0).toLocaleString('pt-BR', {
    style: 'currency',
    currency: 'BRL'
  });
}

function monthKey(d = new Date()) {
  return d.toISOString().slice(0, 7);
}

function formatDate(s) {
  if (!s) return '';
  return new Date(s + 'T12:00:00').toLocaleDateString('pt-BR');
}

function aluno(id) {
  return data.alunos.find(a => String(a.id) === String(id));
}

function esc(s) {
  return String(s ?? '').replace(
    /[&<>"']/g,
    m => ({
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      '"': '&quot;',
      "'": '&#039;'
    }[m])
  );
}


/* =========================
   CARREGAR DADOS
========================= */

async function carregarDados() {

  const { data: alunos, error: erroAlunos } = await db
    .from('alunos')
    .select('*')
    .order('created_at', { ascending: true });

  if (erroAlunos) {
    console.error('Erro ao carregar alunos:', erroAlunos);
    alert('Erro ao carregar os alunos do banco: ' + erroAlunos.message);
    return;
  }

  const { data: pagamentos, error: erroPagamentos } = await db
    .from('pagamentos')
    .select('*')
    .order('created_at', { ascending: false });

  if (erroPagamentos) {
    console.error('Erro ao carregar pagamentos:', erroPagamentos);
    alert('Erro ao carregar os pagamentos do banco: ' + erroPagamentos.message);
    return;
  }

  data.alunos = alunos || [];
  data.pagamentos = pagamentos || [];

  renderAll();
}


/* =========================
   LOGIN
========================= */

function login() {

  const usuario = $('loginUser').value.trim();
  const senha = $('loginPass').value;

  if (usuario === 'admin' && senha === '1234') {

    $('login').classList.add('hidden');
    $('app').classList.remove('hidden');

    renderAll();

  } else {

    alert('Usuário ou senha incorretos.');

  }
}

$('loginBtn').onclick = login;

$('loginPass').addEventListener('keydown', e => {
  if (e.key === 'Enter') {
    login();
  }
});

$('logoutBtn').onclick = () => {
  location.reload();
};

$('today').textContent = new Date().toLocaleDateString(
  'pt-BR',
  { dateStyle: 'full' }
);


/* =========================
   ABAS
========================= */

document.querySelectorAll('.tab').forEach(button => {

  button.onclick = () => {

    document
      .querySelectorAll('.tab')
      .forEach(x => x.classList.remove('active'));

    document
      .querySelectorAll('.panel')
      .forEach(x => x.classList.remove('active'));

    button.classList.add('active');

    const painel = $(button.dataset.tab);

    if (painel) {
      painel.classList.add('active');
    }

    if (button.dataset.tab === 'pagamentos') {
      renderPagamentos();
    }

  };

});


/* =========================
   RENDER GERAL
========================= */

function renderAll() {

  renderDashboard();
  renderAlunos();
  renderPagamentos();
  populatePagAluno();

}


/* =========================
   DASHBOARD
========================= */

function renderDashboard() {

  const ativos = data.alunos.filter(a => a.ativo === true);

  const mesAtual = new Date().toISOString().slice(0, 7);

  const previsto = ativos.reduce(
    (total, a) => total + Number(a.valor_mensal || 0),
    0
  );

  const pagamentosMes = data.pagamentos.filter(p => {

    return (
      p.data_pagamento &&
      p.data_pagamento.slice(0, 7) === mesAtual
    );

  });

  const recebido = pagamentosMes.reduce(
    (total, p) => total + Number(p.valor || 0),
    0
  );

  const alunosPagaram = new Set(
    pagamentosMes.map(p => String(p.aluno_id))
  );

  const atrasados = ativos.filter(
    a => !alunosPagaram.has(String(a.id))
  ).length;

  if ($('mAlunos')) {
    $('mAlunos').textContent = ativos.length;
  }

  if ($('mPrevisto')) {
    $('mPrevisto').textContent = money(previsto);
  }

  if ($('mRecebido')) {
    $('mRecebido').textContent = money(recebido);
  }

  if ($('mAberto')) {
    $('mAberto').textContent =
      money(Math.max(0, previsto - recebido));
  }

  if ($('mAtrasados')) {
    $('mAtrasados').textContent = atrasados;
  }

  if ($('mAntecipados')) {
    $('mAntecipados').textContent = 0;
  }

  if ($('resumo')) {

    $('resumo').textContent =
      `Mês atual: ${new Date().toLocaleDateString('pt-BR', {
        month: 'long',
        year: 'numeric'
      })}.`;

  }

  if ($('alertas')) {

    $('alertas').innerHTML = atrasados
      ? `<div class="alert">⚠️ Existem ${atrasados} aluno(s) sem pagamento registrado neste mês.</div>`
      : `<div class="alert">✅ Nenhum aluno sem pagamento registrado neste mês.</div>`;

  }

}


/* =========================
   LISTA DE ALUNOS
========================= */

function renderAlunos(filter = '') {

  const body = $('alunosBody');

  if (!body) return;

  body.innerHTML = '';

  data.alunos
    .filter(a => {

      const texto =
        (a.nome || '')
