const SUPABASE_URL = 'https://shmkczisodmowazppteb.supabase.co';
const SUPABASE_KEY = 'sb_publishable_c3OKLXg7KKfE8O2hW-cdQw_LYbncxsB';

const db = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

const $ = id => document.getElementById(id);

let data = {
  alunos: [],
  pagamentos: [],
  despesas: []
};

const hoje = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

function monthKey(d = new Date()) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

function money(v) {
  return Number(v || 0).toLocaleString('pt-BR', {
    style: 'currency',
    currency: 'BRL'
  });
}

function formatDate(s) {
  if (!s) return '';
  const [ano, mes, dia] = s.slice(0, 10).split('-');
  return `${dia}/${mes}/${ano}`;
}

function aluno(id) {
  return data.alunos.find(a => String(a.id) === String(id));
}

function esc(s) {
  return String(s ?? '').replace(/[&<>"']/g, m => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#039;'
  }[m]));
}

function dueDate(mes, vencimento) {
  if (!mes) return '';
  const [ano, numeroMes] = mes.split('-').map(Number);
  const ultimoDia = new Date(ano, numeroMes, 0).getDate();
  const dia = Math.min(Number(vencimento) || 1, ultimoDia);
  return `${ano}-${String(numeroMes).padStart(2, '0')}-${String(dia).padStart(2, '0')}`;
}

function pagamentoAntecipado(p) {
  return String(p.observacao || '').includes('[ANTECIPADO]');
}

function observacaoLimpa(p) {
  return String(p.observacao || '')
    .replace('[ANTECIPADO]', '')
    .trim();
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
    console.error(erroAlunos);
    alert('Erro ao carregar alunos: ' + erroAlunos.message);
    return;
  }

  const { data: pagamentos, error: erroPagamentos } = await db
    .from('pagamentos')
    .select('*')
    .order('created_at', { ascending: false });

  if (erroPagamentos) {
    console.error(erroPagamentos);
    alert('Erro ao carregar pagamentos: ' + erroPagamentos.message);
    return;
  }

  data.alunos = alunos || [];
  data.pagamentos = pagamentos || [];

  // Despesas são dados administrativos
  // e só são carregadas para administradores.
  if (ehAdmin()) {

    const { data: despesas, error: erroDespesas } = await db
      .from('despesas')
      .select('*')
      .order('data_despesa', { ascending: false });

    if (erroDespesas) {
      console.error(erroDespesas);
      alert('Erro ao carregar despesas: ' + erroDespesas.message);
      return;
    }

    data.despesas = despesas || [];

  } else {

    data.despesas = [];

  }

  renderAll();
}


/* =========================
   LOGIN
========================= */

let usuarioLogado = null;
let perfilUsuario = null;

async function login() {

  const email = $('loginUser').value.trim();
  const senha = $('loginPass').value;

  if (!email || !senha) {
    alert('Informe o e-mail e a senha.');
    return;
  }

  const botao = $('loginBtn');
  botao.disabled = true;

  try {

    const { data: authData, error: authError } =
      await db.auth.signInWithPassword({
        email,
        password: senha
      });

    if (authError) throw authError;

    usuarioLogado = authData.user;

    const { data: perfil, error: perfilError } = await db
      .from('usuarios')
      .select('*')
      .eq('id', usuarioLogado.id)
      .eq('ativo', true)
      .single();

    if (perfilError || !perfil) {

      await db.auth.signOut();

      usuarioLogado = null;
      perfilUsuario = null;

      throw new Error(
        'Usuário sem permissão de acesso ao sistema.'
      );
    }

    perfilUsuario = perfil;

    aplicarPermissoes();

    $('login').classList.add('hidden');
    $('app').classList.remove('hidden');

    await carregarDados();

  } catch (erro) {

    console.error(erro);

    alert(
      'Não foi possível entrar: ' +
      erro.message
    );

  } finally {

    botao.disabled = false;

  }
}

$('loginBtn').addEventListener('click', login);


let modoRecuperacao = false;

db.auth.onAuthStateChange(async (event, session) => {

  if (event !== 'PASSWORD_RECOVERY') return;

  modoRecuperacao = true;

  const novaSenha = prompt(
    'Digite sua nova senha:'
  );

  if (!novaSenha) {

    await db.auth.signOut();

    return;
  }

  if (novaSenha.length < 6) {

    alert(
      'A senha deve ter pelo menos 6 caracteres.'
    );

    await db.auth.signOut();

    return;
  }

  const { error } = await db.auth.updateUser({
    password: novaSenha
  });

  if (error) {

    console.error(error);

    alert(
      'Não foi possível alterar a senha: ' +
      error.message
    );

    return;
  }

  alert('Senha alterada com sucesso!');

  await db.auth.signOut();

  window.location.hash = '';

  location.reload();
});


$('logoutBtn').onclick = async () => {

  await db.auth.signOut();

  location.reload();

};


$('today').textContent =
  new Date().toLocaleDateString(
    'pt-BR',
    { dateStyle: 'full' }
  );


/* =========================
   PERMISSÕES
========================= */

function ehAdmin() {

  return perfilUsuario?.tipo === 'admin';

}

function ehRecepcao() {

  return perfilUsuario?.tipo === 'recepcao';

}

function exigirAdmin() {

  if (!ehAdmin()) {

    alert(
      'Acesso restrito ao administrador.'
    );

    return false;
  }

  return true;
}


function aplicarPermissoes() {

  if (!perfilUsuario) return;

  const tipo = perfilUsuario.tipo;

  console.log(
    'Usuário logado:',
    perfilUsuario.email
  );

  console.log(
    'Tipo de usuário:',
    tipo
  );


  document
    .querySelectorAll('[data-admin-only]')
    .forEach(elemento => {

      elemento.style.display =
        tipo === 'admin'
          ? ''
          : 'none';

    });


  document
    .querySelectorAll('[data-recepcao]')
    .forEach(elemento => {

      elemento.style.display =
        tipo === 'admin' ||
        tipo === 'recepcao'
          ? ''
          : 'none';

    });

}


/* =========================
   ABAS
========================= */

document
  .querySelectorAll('.tab')
  .forEach(button => {

    button.onclick = () => {

      document
        .querySelectorAll('.tab')
        .forEach(x =>
          x.classList.remove('active')
        );


      document
        .querySelectorAll('.panel')
        .forEach(x =>
          x.classList.remove('active')
        );


      button.classList.add('active');


      const painel =
        $(button.dataset.tab);

      if (painel) {
        painel.classList.add('active');
      }


      if (
        button.dataset.tab ===
        'pagamentos'
      ) {

        renderPagamentos();

        populatePagAluno();

      }


      if (
        button.dataset.tab ===
        'despesas'
      ) {

        if (!exigirAdmin()) {

          abrirAba('dashboard');

          return;
        }

        renderDespesas();

      }

    };

  });


function abrirAba(nome) {

  const botao =
    document.querySelector(
      `.tab[data-tab="${nome}"]`
    );

  if (botao) {
    botao.click();
  }

}


/* =========================
   RENDER GERAL
========================= */

function renderAll() {

  renderDashboard();

  renderAlunos(
    $('buscaAluno')?.value || ''
  );

  renderPagamentos();

  populatePagAluno();


  if (ehAdmin()) {

    renderDespesas();

  }

}


/* =========================
   DASHBOARD
========================= */

function renderDashboard() {

  const mesAtual = monthKey();

  const hojeData = hoje();


  const ativos =
    data.alunos.filter(
      a => a.ativo === true
    );


  const previsto =
    ativos.reduce(
      (total, a) =>
        total +
        Number(a.valor_mensal || 0),
      0
    );


  const pagamentosMes =
    data.pagamentos.filter(
      p =>
        p.data_pagamento &&
        p.data_pagamento.slice(0, 7) ===
        mesAtual
    );


  const recebido =
    pagamentosMes.reduce(
      (total, p) =>
        total +
        Number(p.valor || 0),
      0
    );


  const alunosPagaram =
    new Set(

      data.pagamentos
        .filter(
          p =>
            p.data_vencimento?.slice(0, 7) ===
            mesAtual
        )
        .map(
          p => String(p.aluno_id)
        )

    );


  const atrasados =
    ativos.filter(a => {

      const vencimento =
        dueDate(
          mesAtual,
          a.vencimento
        );

      return (
        vencimento < hojeData &&
        !alunosPagaram.has(
          String(a.id)
        )
      );

    }).length;


  const antecipados =
    pagamentosMes.filter(
      p => pagamentoAntecipado(p)
    ).length;


  if ($('mAlunos'))
    $('mAlunos').textContent =
      ativos.length;


  if ($('mPrevisto'))
    $('mPrevisto').textContent =
      money(previsto);


  if ($('mRecebido'))
    $('mRecebido').textContent =
      money(recebido);


  if ($('mAberto'))
    $('mAberto').textContent =
      money(
        Math.max(
          0,
          previsto - recebido
        )
      );


  if ($('mAtrasados'))
    $('mAtrasados').textContent =
      atrasados;


  if ($('mAntecipados'))
    $('mAntecipados').textContent =
      antecipados;


  if ($('resumo')) {

    $('resumo').textContent =
      `Mês atual: ${
        new Date().toLocaleDateString(
          'pt-BR',
          {
            month: 'long',
            year: 'numeric'
          }
        )
      }. Foram recebidos ${
        money(recebido)
      } de ${
        money(previsto)
      } previstos.`;

  }


  if ($('alertas')) {

    $('alertas').innerHTML =
      atrasados

        ? `<div class="alert">?? Existem ${atrasados} aluno(s) com mensalidade vencida e sem pagamento registrado para este mês.</div>`

        : `<div class="alert">? Nenhum aluno com mensalidade vencida e em aberto neste mês.</div>`;

  }

}


/* =========================
   LISTA DE ALUNOS
========================= */

function renderAlunos(filter = '') {

  const body =
    $('alunosBody');

  if (!body) return;

  body.innerHTML = '';


  const termo =
    filter.trim().toLowerCase();


  const lista =
    data.alunos.filter(a => {

      const texto = [

        a.nome,
        a.telefone,
        a.cpf,
        a.plano

      ]
        .join(' ')
        .toLowerCase();


      return texto.includes(termo);

    });


  if (!lista.length) {

    body.innerHTML = `
      <tr>
        <td colspan="7">
          Nenhum aluno encontrado.
        </td>
      </tr>
    `;

    return;
  }


  lista.forEach(a => {

    const tr =
      document.createElement('tr');


    tr.innerHTML = `

      <td>${esc(a.nome)}</td>

      <td>${esc(a.telefone || '-')}</td>

      <td>${esc(a.plano || '-')}</td>

      <td>${money(a.valor_mensal)}</td>

      <td>
        ${
          a.vencimento
            ? `Dia ${esc(a.vencimento)}`
            : '-'
        }
      </td>

      <td>

        <span
          class="status ${
            a.ativo
              ? 'ativo'
              : 'inativo'
          }">

          ${
            a.ativo
              ? 'Ativo'
              : 'Inativo'
          }

        </span>

      </td>

<td>

  <button
    type="button"
    class="secondary"
    data-pagar="${esc(a.id)}">

    Financeiro

  </button>

  <button
    type="button"
    class="secondary"
    data-historico="${esc(a.id)}">

    Histórico

  </button>

</td>

    `;


    body.appendChild(tr);

  });


  body
    .querySelectorAll('[data-pagar]')
    .forEach(btn => {

      btn.onclick = () => {

        $('pagAluno').value =
          btn.dataset.pagar;


        const selecionado =
          aluno(
            btn.dataset.pagar
          );


        if (selecionado) {

          $('pagValor').value =
            Number(
              selecionado.valor_mensal || 0
            ).toFixed(2);

        }


        abrirAba('pagamentos');

      };

    });
  body
    .querySelectorAll('[data-historico]')
    .forEach(btn => {

      btn.onclick = () => {

        const alunoSelecionado =
          aluno(
            btn.dataset.historico
          );

        if (!alunoSelecionado) {
          alert('Aluno não encontrado.');
          return;
        }

        const pagamentosAluno =
          data.pagamentos
            .filter(
              p =>
                String(p.aluno_id) ===
                String(alunoSelecionado.id)
            )
            .sort((a, b) =>
              String(b.data_pagamento)
                .localeCompare(
                  String(a.data_pagamento)
                )
            );

        $('historicoAlunoNome').textContent =
          alunoSelecionado.nome;

        const bodyHistorico =
          $('historicoBody');

        if (!bodyHistorico) return;

        if (!pagamentosAluno.length) {

          bodyHistorico.innerHTML = `
            <tr>
              <td colspan="5">
                Nenhum pagamento encontrado.
              </td>
            </tr>
          `;

        } else {

          bodyHistorico.innerHTML =
            pagamentosAluno
              .map(p => {

                const referencia =
                  p.data_vencimento
                    ? p.data_vencimento.slice(0, 7)
                    : '-';

                return `
                  <tr>

                    <td>
                      ${formatDate(p.data_pagamento)}
                    </td>

                    <td>
                      ${esc(referencia)}
                    </td>

                    <td>
                      ${money(p.valor)}
                    </td>

                    <td>
                      ${esc(
                        p.forma_pagamento || '-'
                      )}
                    </td>

                    <td>
                      ${esc(
                        observacaoLimpa(p) || '-'
                      )}
                    </td>

                  </tr>
                `;

              })
              .join('');

        }

        $('historicoModal')
          .classList
          .remove('hidden');

      };

    });

}
$('fecharHistorico').addEventListener(
  'click',
  () => {

    $('historicoModal')
      .classList
      .add('hidden');

  }
);


$('buscaAluno').addEventListener(
  'input',
  e => {

    renderAlunos(
      e.target.value
    );

  }
);


/* =========================
   CADASTRO DE ALUNO
========================= */

function abrirModal() {

  $('alunoForm').reset();

  $('modal').classList.remove(
    'hidden'
  );

  $('dataInicio').value =
    hoje();

}


function fecharModal() {

  $('modal').classList.add(
    'hidden'
  );

}


$('novoAlunoBtn').onclick =
  abrirModal;


$('closeModal').onclick =
  fecharModal;


$('modal').addEventListener(
  'click',
  e => {

    if (
      e.target ===
      $('modal')
    ) {

      fecharModal();

    }

  }
);


$('alunoForm').addEventListener(
  'submit',
  async e => {

    e.preventDefault();


    const nome =
      $('nome').value.trim();


    const mensalidade =
      Number(
        $('mensalidade').value
      );


    const vencimento =
      Number(
        $('vencimento').value
      );


    if (
      !nome ||
      mensalidade < 0 ||
      vencimento < 1 ||
      vencimento > 31
    ) {

      alert(
        'Confira o nome, a mensalidade e o dia de vencimento.'
      );

      return;

    }


    const novoAluno = {

      nome,

      cpf:
        $('cpf').value.trim() ||
        null,

      telefone:
        $('telefone').value.trim() ||
        null,

      data_nascimento:
        $('dataNascimento').value ||
        null,

      data_inicio:
        $('dataInicio').value ||
        null,

      plano:
        $('plano').value.trim() ||
        null,

      valor_mensal:
        mensalidade,

      vencimento,

      ativo: true

    };


    const botao =
      $('alunoForm')
        .querySelector(
          '[type="submit"]'
        );


    botao.disabled = true;

    botao.textContent =
      'Salvando...';


    const { error } =
      await db
        .from('alunos')
        .insert([
          novoAluno
        ]);


    botao.disabled = false;

    botao.textContent =
      'Salvar aluno';


    if (error) {

      console.error(error);

      alert(
        'Não foi possível salvar o aluno: ' +
        error.message
      );

      return;

    }


    fecharModal();

    await carregarDados();

    alert(
      'Aluno cadastrado com sucesso!'
    );

  }
);


/* =========================
   SELEÇÃO DO ALUNO NO PAGAMENTO
========================= */

function populatePagAluno() {

  const select =
    $('pagAluno');

  if (!select) return;


  const valorAtual =
    select.value;


  select.innerHTML =
    '<option value="">Selecione o aluno</option>';


  data.alunos

    .filter(
      a => a.ativo === true
    )

    .sort(
      (a, b) =>
        (a.nome || '')
          .localeCompare(
            b.nome || '',
            'pt-BR'
          )
    )

    .forEach(a => {

      const option =
        document.createElement(
          'option'
        );


      option.value =
        a.id;


      option.textContent =
        a.nome;


      select.appendChild(
        option
      );

    });


  if (
    data.alunos.some(
      a =>
        String(a.id) ===
          String(valorAtual) &&
        a.ativo === true
    )
  ) {

    select.value =
      valorAtual;

  }

}


$('pagAluno').addEventListener(
  'change',
  () => {

    const selecionado =
      aluno(
        $('pagAluno').value
      );


    if (selecionado) {

      $('pagValor').value =
        Number(
          selecionado.valor_mensal || 0
        ).toFixed(2);

    }

  }
);


/* =========================
   REGISTRAR PAGAMENTO
========================= */

$('pagMes').value =
  monthKey();

$('pagData').value =
  hoje();


$('pagForm').addEventListener(
  'submit',
  async e => {

    e.preventDefault();


    const alunoSelecionado =
      aluno(
        $('pagAluno').value
      );


    const mes =
      $('pagMes').value;


    const valor =
      Number(
        $('pagValor').value
      );


    const dataPagamento =
      $('pagData').value;


    const forma =
      $('pagForma').value;


    const antecipado =
      $('pagAnt').value ===
      'Sim';


    const observacao =
      $('pagObs').value.trim();


    if (!alunoSelecionado) {

      alert(
        'Selecione um aluno.'
      );

      return;

    }


    if (
      !mes ||
      !dataPagamento ||
      !Number.isFinite(valor) ||
      valor <= 0
    ) {

      alert(
        'Preencha o mês, a data e um valor válido.'
      );

      return;

    }


    const vencimento =
      dueDate(
        mes,
        alunoSelecionado.vencimento
      );


    const obsFinal = [

      antecipado
        ? '[ANTECIPADO]'
        : '',

      observacao

    ]
      .filter(Boolean)
      .join(' ');


    const pagamento = {

      aluno_id:
        alunoSelecionado.id,

      valor,

      data_pagamento:
        dataPagamento,

      data_vencimento:
        vencimento,

      forma_pagamento:
        forma,

      observacao:
        obsFinal || null

    };


    const botao =
      $('pagForm')
        .querySelector(
          '[type="submit"]'
        );


    botao.disabled = true;

    botao.textContent =
      'Registrando...';


    const { error } =
      await db
        .from('pagamentos')
        .insert([
          pagamento
        ]);


    botao.disabled = false;

    botao.textContent =
      'Registrar pagamento';


    if (error) {

      console.error(error);

      alert(
        'Erro ao registrar pagamento: ' +
        error.message
      );

      return;

    }


    $('pagForm').reset();

    $('pagMes').value =
      monthKey();

    $('pagData').value =
      hoje();

    $('pagAnt').value =
      'Não';


    await carregarDados();

    alert(
      'Pagamento registrado com sucesso!'
    );

  }
);


/* =========================
   HISTÓRICO DE PAGAMENTOS
========================= */

function renderPagamentos() {

  const body =
    $('pagBody');

  if (!body) return;

  body.innerHTML = '';


  if (!data.pagamentos.length) {

    body.innerHTML = `
      <tr>
        <td colspan="6">
          Nenhum pagamento registrado.
        </td>
      </tr>
    `;

    return;

  }


  data.pagamentos.forEach(p => {

    const a =
      aluno(p.aluno_id);


    const tr =
      document.createElement(
        'tr'
      );


    tr.innerHTML = `

      <td>
        ${formatDate(
          p.data_pagamento
        )}
      </td>

      <td>
        ${esc(
          a?.nome ||
          'Aluno não encontrado'
        )}
      </td>

      <td>
        ${esc(
          p.data_vencimento?.slice(
            0,
            7
          ) || '-'
        )}
      </td>

      <td>
        ${money(p.valor)}
      </td>

      <td>
        ${esc(
          p.forma_pagamento ||
          '-'
        )}
      </td>

      <td>
        ${
          p.created_at
            ? formatDate(
                p.created_at.slice(
                  0,
                  10
                )
              )
            : '-'
        }
      </td>

    `;


    body.appendChild(tr);

  });

}


/* =========================
   DESPESAS — ADMIN
========================= */

function renderDespesas() {

  const body =
    $('despesasBody');

  if (!body) return;


  if (!ehAdmin()) {

    body.innerHTML = `
      <tr>
        <td colspan="5">
          Acesso restrito ao administrador.
        </td>
      </tr>
    `;

    if ($('mDespesas')) {

      $('mDespesas').textContent =
        money(0);

    }

    return;

  }


  const mesAtual =
    monthKey();


  const despesasMes =
    data.despesas.filter(
      d =>
        d.data_despesa &&
        d.data_despesa.slice(
          0,
          7
        ) === mesAtual
    );


  const totalMes =
    despesasMes.reduce(
      (total, d) =>
        total +
        Number(d.valor || 0),
      0
    );


  if ($('mDespesas')) {

    $('mDespesas').textContent =
      money(totalMes);

  }


  body.innerHTML = '';


  if (!data.despesas.length) {

    body.innerHTML = `
      <tr>
        <td colspan="5">
          Nenhuma despesa cadastrada.
        </td>
      </tr>
    `;

    return;

  }


  data.despesas.forEach(d => {

    const tr =
      document.createElement(
        'tr'
      );


    tr.innerHTML = `

      <td>
        ${formatDate(
          d.data_despesa
        )}
      </td>

      <td>
        ${esc(
          d.descricao ||
          '-'
        )}
      </td>

      <td>
        ${esc(
          d.categoria ||
          '-'
        )}
      </td>

      <td>
        ${money(d.valor)}
      </td>

      <td>
        ${esc(
          d.observacao ||
          '-'
        )}
      </td>

    `;


    body.appendChild(tr);

  });

}


function prepararFormularioDespesa() {

  if (!$('despesaData'))
    return;


  if (!$('despesaData').value) {

    $('despesaData').value =
      hoje();

  }

}


const despesaForm =
  $('despesaForm');


if (despesaForm) {

  despesaForm.addEventListener(
    'submit',
    async e => {

      e.preventDefault();


      if (!exigirAdmin())
        return;


      const descricao =
        $('despesaDescricao')
          .value
          .trim();


      const valor =
        Number(
          $('despesaValor').value
        );


      const dataDespesa =
        $('despesaData').value;


      const categoria =
        $('despesaCategoria').value;


      const observacao =
        $('despesaObservacao')
          .value
          .trim();


      if (
        !descricao ||
        !dataDespesa ||
        !categoria ||
        !Number.isFinite(valor) ||
        valor <= 0
      ) {

        alert(
          'Preencha a descrição, valor, data e categoria.'
        );

        return;

      }


      const despesa = {

        descricao,

        valor,

        data_despesa:
          dataDespesa,

        categoria,

        observacao:
          observacao || null

      };


      const botao =
        despesaForm
          .querySelector(
            '[type="submit"]'
          );


      botao.disabled = true;

      botao.textContent =
        'Salvando...';


      const { error } =
        await db
          .from('despesas')
          .insert([
            despesa
          ]);


      botao.disabled = false;

      botao.textContent =
        'Registrar despesa';


      if (error) {

        console.error(error);

        alert(
          'Erro ao registrar despesa: ' +
          error.message
        );

        return;

      }


      despesaForm.reset();

      $('despesaData').value =
        hoje();


      await carregarDados();


      abrirAba(
        'despesas'
      );


      alert(
        'Despesa registrada com sucesso!'
      );

    }
  );


  prepararFormularioDespesa();

}
/* =========================
   RELATÓRIOS — ADMIN
========================= */

function prepararRelatorio() {
  const inicial = $('relatorioDataInicial');
  const final = $('relatorioDataFinal');

  if (!inicial || !final) return;

  const hojeData = new Date();

  const primeiroDia = new Date(
    hojeData.getFullYear(),
    hojeData.getMonth(),
    1
  );

  const ultimoDia = new Date(
    hojeData.getFullYear(),
    hojeData.getMonth() + 1,
    0
  );

  const formatar = d =>
    `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

  if (!inicial.value) {
    inicial.value = formatar(primeiroDia);
  }

  if (!final.value) {
    final.value = formatar(ultimoDia);
  }
}


function gerarRelatorio() {
  if (!exigirAdmin()) return;

  const dataInicial = $('relatorioDataInicial')?.value;
  const dataFinal = $('relatorioDataFinal')?.value;

  if (!dataInicial || !dataFinal) {
    alert('Informe a data inicial e a data final.');
    return;
  }

  if (dataInicial > dataFinal) {
    alert('A data inicial não pode ser maior que a data final.');
    return;
  }

  const pagamentosPeriodo = data.pagamentos.filter(p =>
    p.data_pagamento &&
    p.data_pagamento >= dataInicial &&
    p.data_pagamento <= dataFinal
  );

  const despesasPeriodo = data.despesas.filter(d =>
    d.data_despesa &&
    d.data_despesa >= dataInicial &&
    d.data_despesa <= dataFinal
  );

  const receitas = pagamentosPeriodo.reduce(
    (total, p) => total + Number(p.valor || 0),
    0
  );

  const despesas = despesasPeriodo.reduce(
    (total, d) => total + Number(d.valor || 0),
    0
  );

  const saldo = receitas - despesas;

  if ($('relatorioReceitas')) {
    $('relatorioReceitas').textContent = money(receitas);
  }

  if ($('relatorioDespesas')) {
    $('relatorioDespesas').textContent = money(despesas);
  }

  if ($('relatorioSaldo')) {
    $('relatorioSaldo').textContent = money(saldo);
  }

  if ($('relatorioQtdPagamentos')) {
    $('relatorioQtdPagamentos').textContent =
      pagamentosPeriodo.length;
  }

  if ($('relatorioQtdDespesas')) {
    $('relatorioQtdDespesas').textContent =
      despesasPeriodo.length;
  }

  if ($('relatorioResumo')) {
    $('relatorioResumo').innerHTML = `
      <strong>Período:</strong>
      ${formatDate(dataInicial)} até ${formatDate(dataFinal)}
      <br><br>

      Foram registrados
      <strong>${pagamentosPeriodo.length}</strong>
      pagamento(s), totalizando
      <strong>${money(receitas)}</strong>
      em receitas.

      <br>

      Foram registradas
      <strong>${despesasPeriodo.length}</strong>
      despesa(s), totalizando
      <strong>${money(despesas)}</strong>
      em despesas.

      <br><br>

      <strong>Saldo do período:
      ${money(saldo)}</strong>
    `;
  }
}


const gerarRelatorioBtn = $('gerarRelatorioBtn');

if (gerarRelatorioBtn) {
  gerarRelatorioBtn.addEventListener(
    'click',
    gerarRelatorio
  );
}

/* =========================
   FECHAMENTO MENSAL — ADMIN
========================= */

function prepararFechamentoMensal() {

  const mes = $('fechamentoMes');

  if (!mes) return;

  if (!mes.value) {
    mes.value = monthKey();
  }

}


function gerarFechamentoMensal() {

  if (!exigirAdmin()) return;

  const mesSelecionado =
    $('fechamentoMes')?.value;

  if (!mesSelecionado) {
    alert('Selecione o mês.');
    return;
  }

  const partes = mesSelecionado.split('-');

  const ano = Number(partes[0]);
  const mes = Number(partes[1]);

  const dataInicial =
    `${ano}-${String(mes).padStart(2, '0')}-01`;

  const ultimoDia =
    new Date(ano, mes, 0).getDate();

  const dataFinal =
    `${ano}-${String(mes).padStart(2, '0')}-${String(ultimoDia).padStart(2, '0')}`;


  /* =========================
     PAGAMENTOS
  ========================= */

  const pagamentosPeriodo =
    data.pagamentos.filter(p =>
      p.data_pagamento &&
      p.data_pagamento >= dataInicial &&
      p.data_pagamento <= dataFinal
    );


  /* =========================
     DESPESAS
  ========================= */

  const despesasPeriodo =
    data.despesas.filter(d =>
      d.data_despesa &&
      d.data_despesa >= dataInicial &&
      d.data_despesa <= dataFinal
    );


  /* =========================
     CÁLCULOS
  ========================= */

  const receitas =
    pagamentosPeriodo.reduce(
      (total, p) =>
        total + Number(p.valor || 0),
      0
    );


  const despesas =
    despesasPeriodo.reduce(
      (total, d) =>
        total + Number(d.valor || 0),
      0
    );


  const saldo =
    receitas - despesas;


  /* =========================
     RESUMO
  ========================= */

  if ($('fechamentoReceitas')) {
    $('fechamentoReceitas').textContent =
      money(receitas);
  }


  if ($('fechamentoDespesas')) {
    $('fechamentoDespesas').textContent =
      money(despesas);
  }


  if ($('fechamentoSaldo')) {
    $('fechamentoSaldo').textContent =
      money(saldo);
  }


  if ($('fechamentoQtdPagamentos')) {
    $('fechamentoQtdPagamentos').textContent =
      pagamentosPeriodo.length;
  }


  if ($('fechamentoQtdDespesas')) {
    $('fechamentoQtdDespesas').textContent =
      despesasPeriodo.length;
  }


  /* =========================
     DESPESAS POR CATEGORIA
  ========================= */

   const categorias = {};

  despesasPeriodo.forEach(d => {

    const categoria =
      d.categoria || 'Outros';

    if (!categorias[categoria]) {
      categorias[categoria] = {
        quantidade: 0,
        total: 0
      };
    }

    categorias[categoria].quantidade++;

    categorias[categoria].total +=
      Number(d.valor || 0);

  });


  const categoriasEl =
    $('fechamentoCategorias');


  if (categoriasEl) {

    const lista =
      Object.entries(categorias)
        .sort((a, b) =>
          b[1].total - a[1].total
        );


    if (!lista.length) {

      categoriasEl.innerHTML = `
        <tr>
          <td colspan="3">
            Nenhuma despesa registrada no mês.
          </td>
        </tr>
      `;

    } else {

      categoriasEl.innerHTML =
        lista.map(([categoria, dados]) => `

          <tr>

            <td>
              ${esc(categoria)}
            </td>

            <td>
              ${dados.quantidade}
            </td>

            <td>
              ${money(dados.total)}
            </td>

          </tr>

        `).join('');

    }

  }
  /* =========================
     RESUMO DO MÊS
  ========================= */

  if ($('fechamentoResumo')) {

    $('fechamentoResumo').innerHTML = `

      <strong>Período:</strong>
      ${formatDate(dataInicial)}
      até
      ${formatDate(dataFinal)}

      <br><br>

      Foram registrados
      <strong>${pagamentosPeriodo.length}</strong>
      pagamento(s), totalizando
      <strong>${money(receitas)}</strong>
      em receitas.

      <br><br>

      Foram registradas
      <strong>${despesasPeriodo.length}</strong>
      despesa(s), totalizando
      <strong>${money(despesas)}</strong>
      em despesas.

      <br><br>

      <strong>
        Saldo do mês:
        ${money(saldo)}
      </strong>

    `;

  }

}


const gerarFechamentoBtn =
  $('gerarFechamentoBtn');


if (gerarFechamentoBtn) {

  gerarFechamentoBtn.addEventListener(
    'click',
    gerarFechamentoMensal
  );

}


prepararFechamentoMensal();


prepararRelatorio();
/* =========================
   FLUXO DE CAIXA — ADMIN
========================= */

function prepararFluxoCaixa() {
  const inicial = $('fluxoDataInicial');
  const final = $('fluxoDataFinal');

  if (!inicial || !final) return;

  const hojeData = new Date();

  const primeiroDia = new Date(
    hojeData.getFullYear(),
    hojeData.getMonth(),
    1
  );

  const ultimoDia = new Date(
    hojeData.getFullYear(),
    hojeData.getMonth() + 1,
    0
  );

  const formatar = d =>
    `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

  if (!inicial.value) {
    inicial.value = formatar(primeiroDia);
  }

  if (!final.value) {
    final.value = formatar(ultimoDia);
  }
}


function gerarFluxoCaixa() {

  if (!exigirAdmin()) return;

  const dataInicial = $('fluxoDataInicial')?.value;
  const dataFinal = $('fluxoDataFinal')?.value;

  if (!dataInicial || !dataFinal) {
    alert('Informe a data inicial e a data final.');
    return;
  }

  if (dataInicial > dataFinal) {
    alert('A data inicial não pode ser maior que a data final.');
    return;
  }

  /* =========================
     ENTRADAS
  ========================= */

  const pagamentosPeriodo = data.pagamentos.filter(p =>
    p.data_pagamento &&
    p.data_pagamento >= dataInicial &&
    p.data_pagamento <= dataFinal
  );


  /* =========================
     SAÍDAS
  ========================= */

  const despesasPeriodo = data.despesas.filter(d =>
    d.data_despesa &&
    d.data_despesa >= dataInicial &&
    d.data_despesa <= dataFinal
  );


  /* =========================
     CÁLCULOS
  ========================= */

  const entradas = pagamentosPeriodo.reduce(
    (total, p) =>
      total + Number(p.valor || 0),
    0
  );


  const saidas = despesasPeriodo.reduce(
    (total, d) =>
      total + Number(d.valor || 0),
    0
  );


  const saldo = entradas - saidas;


  /* =========================
     RESUMO
  ========================= */

  if ($('fluxoEntradas')) {
    $('fluxoEntradas').textContent =
      money(entradas);
  }


  if ($('fluxoSaidas')) {
    $('fluxoSaidas').textContent =
      money(saidas);
  }


  if ($('fluxoSaldo')) {
    $('fluxoSaldo').textContent =
      money(saldo);
  }


  if ($('fluxoQtdEntradas')) {
    $('fluxoQtdEntradas').textContent =
      pagamentosPeriodo.length;
  }


  if ($('fluxoQtdSaidas')) {
    $('fluxoQtdSaidas').textContent =
      despesasPeriodo.length;
  }


  /* =========================
     MOVIMENTAÇÕES
  ========================= */

  const movimentos = [

    ...pagamentosPeriodo.map(p => ({
      data: p.data_pagamento,
      tipo: 'Entrada',
      descricao:
        aluno(p.aluno_id)?.nome ||
        'Pagamento',
      categoria: 'Mensalidade',
      valor: Number(p.valor || 0)
    })),

    ...despesasPeriodo.map(d => ({
      data: d.data_despesa,
      tipo: 'Saída',
      descricao: d.descricao || 'Despesa',
      categoria: d.categoria || 'Outros',
      valor: Number(d.valor || 0)
    }))

  ];


  movimentos.sort((a, b) =>
    String(b.data).localeCompare(
      String(a.data)
    )
  );


  const body = $('fluxoBody');


  if (body) {

    if (!movimentos.length) {

      body.innerHTML = `
        <tr>
          <td colspan="5">
            Nenhuma movimentação encontrada
            no período.
          </td>
        </tr>
      `;

    } else {

      body.innerHTML =
        movimentos.map(m => `

          <tr>

            <td>
              ${formatDate(m.data)}
            </td>

            <td>
              ${esc(m.tipo)}
            </td>

            <td>
              ${esc(m.descricao)}
            </td>

            <td>
              ${esc(m.categoria)}
            </td>

            <td>
              ${money(m.valor)}
            </td>

          </tr>

        `).join('');

    }

  }

}


const gerarFluxoBtn =
  $('gerarFluxoBtn');


if (gerarFluxoBtn) {

  gerarFluxoBtn.addEventListener(
    'click',
    gerarFluxoCaixa
  );

}


prepararFluxoCaixa();

/* =========================
   INICIALIZAÇÃO
========================= */

$('pagMes').value =
  monthKey();

$('pagData').value =
  hoje();

prepararFormularioDespesa();
