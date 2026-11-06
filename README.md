# Fluxo: Kanban colaborativo

Sistema web responsivo de gestão Kanban (**projetos → quadros → colunas → cards**) com contas verificadas, convites, papéis por projeto, colaboração em tempo real, imagens com cota, filtros e visão geral. Interface em português do Brasil e inglês.

**Stack:** Next.js 15 (App Router, Server Actions) · Supabase (Auth, Postgres com RLS, Realtime, Storage) · Tailwind CSS 4 · dnd-kit · Tiptap.

---

## Como rodar

### 1. Crie o projeto no Supabase

1. Crie um projeto em [supabase.com](https://supabase.com).
2. Rode a migração `supabase/migrations/20261106000000_init.sql`:
   - pelo **SQL Editor** do painel (cole e execute), ou
   - pela CLI: `supabase link --project-ref <ref>` e depois `supabase db push`.
3. Em **Authentication → Providers → Email**, deixe **Confirm email** ligado.
4. Em **Authentication → URL Configuration**:
   - **Site URL:** a URL pública do app (ex.: `https://seu-app.vercel.app`)
   - **Redirect URLs:** `https://seu-app.vercel.app/auth/confirm` (e `http://localhost:3000/auth/confirm` para desenvolvimento)
5. Para produção, configure um SMTP próprio em **Authentication → SMTP Settings**. O SMTP padrão do Supabase tem limite baixo de envios.

### 2. Configure e rode o app

```bash
cp .env.example .env.local   # preencha com as chaves do Supabase (Project Settings → API)
npm install
npm run dev                  # http://localhost:3000
```

| Variável | Para quê |
|---|---|
| `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Conexão do app com o Supabase |
| `SUPABASE_SERVICE_ROLE_KEY` | **Só no servidor.** Gera URLs de upload/visualização de imagens e exclui contas. Usada sempre depois de checar a permissão |
| `NEXT_PUBLIC_SITE_URL` | Links de convite e de e-mail |
| `NEXT_PUBLIC_APP_TIMEZONE` | Fuso dos alertas de prazo (validação pendente nº 9) |
| `NEXT_PUBLIC_DUE_SOON_DAYS`, `NEXT_PUBLIC_DUE_SOON_INCLUDES_DUE_DATE` | Regra de “vence em breve” (validação pendente nº 8) |
| `RESEND_API_KEY`, `INVITE_FROM_EMAIL` | Opcional: envio de convites por e-mail via Resend. Sem chave, a tela mostra o link do convite para copiar |

### 3. Publique (Vercel)

Importe o repositório na Vercel, cadastre as mesmas variáveis de ambiente e faça o deploy. O HTTPS é automático, e o app também envia o cabeçalho HSTS.

### Testes

```bash
npm test          # regras de prazo, filtros e posições
npm run typecheck
# Regras do banco (RLS, papéis, cota, arquivamento) contra um Postgres local:
psql -v ON_ERROR_STOP=1 -d <db> -f supabase/tests/supabase_stub.sql \
  -f supabase/migrations/20261106000000_init.sql -f supabase/tests/rls_test.sql
```

---

## Como o sistema garante as regras

**Autorização no servidor.** Toda a autorização fica no Postgres: RLS em todas as tabelas, privilégios de escrita por coluna e funções `SECURITY DEFINER` que conferem o papel antes de agir (`create_project`, `archive_project`, `delete_column`, `remove_member`, `accept_invitation`…). O cliente não consegue, por exemplo, mudar `owner_id` ou `archived_at` diretamente. O Realtime do Supabase aplica as mesmas políticas de leitura a cada assinante.

| Requisito | Onde |
|---|---|
| Conta só ativa após confirmar o e-mail; sem acesso automático | Supabase Auth (Confirm email) + `is_verified()` + convite obrigatório |
| Convites de 7 dias, reenviar/cancelar, acesso só com o mesmo e-mail verificado | `create_invitation`, `resend_invitation`, `cancel_invitation`, `accept_invitation` |
| Dono, administrador e integrante; ninguém remove o dono | `my_role`, `can_admin`, `can_manage_member`, índice único de dono |
| Arquivar, restaurar por 30 dias e nunca excluir automaticamente | `archive_project`, `restore_project`; exclusão só manual (`delete_project`, com o nome digitado) |
| Remover coluna com cards: destino obrigatório, ordem preservada, tudo ou nada | `delete_column` (uma transação) + FK `on delete restrict` |
| Conclusão pela marcação, não pelo nome | `board_columns.is_done` (só dono/admin alteram) |
| Imagens JPEG/PNG/WebP, 10 MB, 3 por card, 1 GB por projeto | Checagem prévia `check_image_upload`, bytes reais conferidos no servidor e `register_card_image` com trava por projeto. Bucket privado com limite de tipo e tamanho |
| Edições simultâneas sem sobrescrever | `cards.version`: o salvamento só passa se a versão bater; senão a tela compara as versões campo a campo |
| Offline sem perder nada | Rascunho do card no aparelho + fila de ações reenviáveis e idempotentes (ids gerados no cliente) |
| Descrição protegida contra injeção | `sanitize-html` no servidor, só com negrito, itálico, listas e links |

**Acessibilidade.** Tudo funciona pelo teclado. No quadro, Enter abre o card e Espaço inicia ou solta o arrasto. Cada card e cada coluna também tem menu com “Subir/Descer/Mover para…” e “Mover para a esquerda/direita”. Movimentações são anunciadas para leitores de tela, o foco é sempre visível, os alvos de toque têm pelo menos 44 × 44 px, o prazo aparece com texto e ícone (nunca só com cor) e o app respeita `prefers-reduced-motion`. No celular, o quadro mostra uma coluna por vez (abas), o card abre em tela cheia e mover cards usa o seletor, sem depender de gestos.

---

## Validações pendentes antes do lançamento

O código implementa as decisões confirmadas. Os pontos abaixo estão **sinalizados e fáceis de ajustar**: nenhum é tratado como decisão final nem como garantia.

| # | Item | Estado no código / onde ajustar |
|---|---|---|
| 1 | Volume (500 cards/quadro, 50 integrantes) e quadro em até 3 s | Quadro carregado inteiro e filtrado no cliente. Testar com dados reais |
| 2 | Tempo real em até 2 s; disponibilidade de 99,5% | Depende do plano e da região do Supabase. **Não é SLA** |
| 3 | Backups, RPO/RTO | Configurar backups/PITR no Supabase. A retenção máxima já definida é de 30 dias |
| 4 | LGPD | Política de privacidade e fluxos de acesso/anonimização a revisar. O app não registra conteúdo de descrições nem imagens em análises de uso (não há analytics embutido) |
| 5 | Compatibilidade | Testar em dispositivos reais (Chrome, Safari, Firefox, Edge, Android, iOS) |
| 6 | Segurança de senha e sessões | Regra inicial: ≥ 8 caracteres, letras e números (`src/app/actions/auth.ts`). Limite de tentativas: rate limits do Supabase Auth (ajuste no painel) |
| 7 | Exclusão de conta de quem é dono | **Bloqueada** enquanto houver projetos próprios; a tela lista quais transferir ou excluir (`owned_projects`) |
| 8 | “Vence em breve” inclui o dia do vencimento? | `NEXT_PUBLIC_DUE_SOON_INCLUDES_DUE_DATE` (padrão `true`); janela em `NEXT_PUBLIC_DUE_SOON_DAYS` |
| 9 | Fuso dos alertas | `NEXT_PUBLIC_APP_TIMEZONE` (recomendação inicial `America/Sao_Paulo`) |
| 10 | O que integrantes comuns podem editar | Inicial: cards e imagens. Colunas e quadros ficam com dono/admin. Trocar em `perm_members_manage_columns()` (SQL) e `membersManageColumns` (página do quadro) |
| 11 | Metas de uso | Não bloqueiam o MVP |

Outras decisões de implementação que vale revisar:

- **Integrante desativado** perde o acesso ao projeto (além de não aparecer para atribuição) até ser reativado.
- **Exclusão definitiva** exige que o projeto esteja arquivado (dentro ou depois dos 30 dias) e que o dono digite o nome do projeto.
- Eventos de exclusão em tempo real do Supabase não aceitam filtro e chegam a todos os assinantes, mas trazem **apenas o id** removido, sem nenhum conteúdo.
- Se alguém abandonar um upload entre o envio e a confirmação, pode sobrar um arquivo órfão no Storage, que não conta na cota. Recomenda-se uma limpeza periódica.

Fora do MVP, conforme o escopo: notificações, comentários, integrações, automações, relatórios, app nativo, subtarefas, checklists, etiquetas e dependências.
