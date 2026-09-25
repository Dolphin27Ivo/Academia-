# Sistema Web — Academia v1

Esta é a primeira versão funcional do sistema.

## O que já funciona
- Login de administrador (demo: `admin` / `1234`)
- Cadastro de alunos
- Ativar/inativar aluno
- Registro de pagamentos
- Valor mensal puxado automaticamente do cadastro
- Registro de data/hora do lançamento
- Dashboard com previsto, recebido, aberto, atrasados e antecipados
- Pesquisa de alunos
- Interface responsiva para celular

## Importante nesta versão
Os dados ficam no `localStorage` do navegador. Portanto, esta versão é um protótipo funcional e **não é ainda a versão para uso compartilhado de qualquer lugar**.

Para transformar em sistema online de verdade, o próximo passo é trocar o armazenamento local por um banco de dados online (por exemplo, Supabase/Firebase), criar login individual do administrador e do instrutor e registrar uma trilha de auditoria.

## Como testar
Abra `index.html` no navegador. Entre com:
Usuário: admin
Senha: 1234

## Próxima versão recomendada
- Banco de dados online
- Login separado: administrador / instrutor
- Instrutor registra pagamentos, mas não apaga registros
- Administrador vê tudo de qualquer dispositivo
- Relatório mensal
- Exportação Excel/PDF
- Controle de despesas
- Backup automático
