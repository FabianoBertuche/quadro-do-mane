# Roadmap de Finalização — Quadro do Manê

> Documento de apresentação ao cliente.
> Lista o que **já está pronto**, o que **falta programar**, e quanto tempo
> cada etapa levaria para **1 programador (nível júnior → início de pleno)**
> executando **da forma tradicional, sem uso de IA**.
>
> Estimativas em **dias úteis** (jornada de 6–8 horas/dia).

---

## 1. Resumo em linguagem simples

O sistema é dividido em 4 partes: o **app (celular)**, o **sistema (site de
gerência)** e o **coração (servidor)** que guarda e organiza todos os dados.

- **Celular Android:** está praticamente pronto (95%). Usuários já abrem o app,
  veem tarefas, projetos, calendário, e-mails e recebem avisos no celular.
- **Celular iPhone (iOS):** não existe nada programado ainda — todas as telas e
  recursos precisam ser criados do zero (maior parte do prazo do projeto).
- **Sistema (site):** tudo o que o cliente usa no computador já está pronto.
  Faltam apenas melhorias opcionais (relatórios, permissões, ajustes no e-mail).
- **Coração (servidor):** está funcionando. Faltam proteções e conveniências
  (bloqueio de senha errada, convite por e-mail) e uma correção no instalador.

**Tempo total estimado: aproximadamente 105 a 179 dias úteis**
(≈ 5 a 8 meses com 1 programador). Veja o detalhamento abaixo.

---

## 2. O que já está pronto (o cliente já possui isso)

| Área | O que funciona hoje |
|---|---|
| **Android** | App instalado no celular com: login, painel, tarefas (quadro Kanban), projetos, equipes, calendário, contatos, notificações, rotina diária, e-mail, auditoria. |
| **Sistema web** | Mesmos recursos do app, acessíveis pelo navegador, com painel administrativo (criar usuários, permissões, histórico). |
| **Servidor** | Banco de dados, segurança de acesso por usuário, registro de histórico (auditoria), envio de avisos (push) e e-mail. Acesso por site seguro (https). |
| **Publicação Android** | Cópia de instalação (.apk) já gerada e testada. |

---

## 3. Fases que faltam programar

### Fase A — App Android: finalização (pequenos ajustes)

| # | Etapa (o que é) | Por que importa | Estimativa |
|---|---|---|---|
| A1 | **Administrar membros do projeto no app** — tela para incluir/remover quem participa de cada projeto. | Hoje só é possível ver o responsável; incluir/remover exige o computador. | 1–2 dias |
| A2 | **Anexar arquivos nas tarefas** — escolher foto/documento, anexar à tarefa e abrir depois. | Necessário para comprovar entregas (NFs, fotos, PDFs). | 2–4 dias |
| A3 | **Arrastar tarefas no quadro** — mover tarefa de uma coluna para outra "segurando" com o dedo (hoje usa botões de seta). | Uso mais natural do quadro no celular. | 3–5 dias |
| A4 | **Foto de perfil no app** — escolher/excluir a foto do usuário. | Personalização e identificação visual. | 0,5–1 dia |
| A5 | **Tela de Configurações no app** — item que existe no menu, mas ainda sem tela. | Permite que o usuário ajuste dados do app sem usar o computador. | 1–2 dias |

**Subtotal Fase A: 7 a 14 dias úteis (≈ 1,5 a 3 semanas)**

---

### Fase B — App iPhone (iOS): construção completa do zero

> **Importante:** para efeito de prazo, esta fase considera que **não existe
> nada programado para o iPhone**. Todas as telas, o login, as funções, os
> avisos e o empacotamento precisam ser **criados do zero** pela programação.
> O único aproveitamento é o "coração" do sistema (servidor), que já existe e
> com o qual o app vai conversar. As etapas abaixo são as **básicas**, em ordem,
> com o tempo de cada uma.

#### Bloco 1 — Estrutura, base e entrada

| # | Etapa (o que é) | O que envolve (detalhe para quem não é da área) | Estimativa |
|---|---|---|---|
| B1 | **Preparar o projeto novo do iPhone** | Instalar as ferramentas, criar a estrutura do programa, configurar o tema visual (cores) e conectar com o servidor existente. | 2–4 dias |
| B2 | **Criar a tela de login e a sessão segura** | Tela de entrar com e-mail e senha, escolher a conta/empresa, guardar o acesso no cofre seguro do iPhone e sair com segurança. Inclui "esqueci minha senha". | 3–5 dias |

#### Bloco 2 — Navegação

| # | Etapa (o que é) | O que envolve (detalhe para quem não é da área) | Estimativa |
|---|---|---|---|
| B3 | **Criar a navegação principal do app** | As abas de baixo da tela (Início, Tarefas, Projetos, Mais) e o menu secundário com todas as funções. | 2–3 dias |

#### Bloco 3 — Telas e funções (o coração do app)

| # | Etapa (o que é) | O que envolve (detalhe para quem não é da área) | Estimativa |
|---|---|---|---|
| B4 | **Painel inicial (dashboard)** | Tela de abertura com os totais do dia: tarefas, concluídas, atrasadas e desempenho. | 3–5 dias |
| B5 | **Tarefas: lista, pesquisa e quadro (kanban)** | Lista de tarefas com filtros + quadro em colunas para organizar por andamento. | 5–8 dias |
| B6 | **Tarefa: detalhe, criar e editar** | Abrir uma tarefa, ver e alterar responsável, prioridade, prazo, status, comentários, e criar/editar tarefas. | 5–8 dias |
| B7 | **Subtarefas e checklists** | Dividir tarefa em partes menores e criar listas de conferência (checklists) dentro dela. | 3–5 dias |
| B8 | **Projetos: lista, criar, detalhe e membros** | Ver projetos, criar novo projeto e administrar quem participa dele. | 5–7 dias |
| B9 | **Equipes e Colaboradores** | Telas que listam os times e as pessoas da empresa. | 3–5 dias |
| B10 | **Calendário e eventos** | Agenda por dia, criar eventos com responsável e participantes, inclusive eventos que se repetem. | 5–8 dias |
| B11 | **Contatos** | Lista telefônica com criar/editar contato. | 2–3 dias |
| B12 | **Rotina diária** | Checklist do dia + criar itens da rotina (e gestão pelo responsável). | 3–5 dias |
| B13 | **Notificações** | Lista de avisos recebidos, marcar como lida e marcar todas como lidas. | 2–3 dias |
| B14 | **E-mail** | Caixa de entrada, ler mensagem, responder e escrever e-mail novo dentro do app. | 5–8 dias |
| B15 | **Auditoria e Atividades** | Histórico de tudo que acontece no sistema (quem fez o quê e quando). | 3–5 dias |
| B16 | **Perfil e Configurações** | Editar dados pessoais, escolher foto e telas de configuração do app. | 2–4 dias |
| B17 | **Anexos nas tarefas** | Anexar fotos/documentos a uma tarefa e abri-los depois. | 2–4 dias |

#### Bloco 4 — Avisos e apresentação

| # | Etapa (o que é) | O que envolve (detalhe para quem não é da área) | Estimativa |
|---|---|---|---|
| B18 | **Avisos no celular (push)** | Fazer o iPhone receber notificações do sistema (nova tarefa, lembrete). | 2–4 dias |
| B19 | **Ícones, imagem de abertura e permissões** | Desenho do app em todos os tamanhos que a Apple exige, tela de abertura (splash) e perguntas de permissão de câmera/galeria para fotos. | 2–3 dias |

#### Bloco 5 — Empacotamento e instalação

| # | Etapa (o que é) | O que envolve (detalhe para quem não é da área) | Estimativa |
|---|---|---|---|
| B20 | **Conta Apple Developer + registro do app e aparelho** | O cliente cria a conta paga (US$ 99/ano) e o programador registra o identificador do app e o número único do iPhone do cliente (UDID). | 1 dia + espera da Apple (1 a 5 dias úteis) |
| B21 | **Certificados de segurança e perfil de instalação** | Assinatura digital do app e o documento que autoriza instalar no aparelho. Parte mais burocrática. | 1–2 dias |
| B22 | **Versão de teste no simulador** | Montar o app para um "iPhone virtual", corrigir erros de montagem e conferir que abre e navega. | 2–4 dias |
| B23 | **Ajustes específicos do iPhone** | Teclado que não esconde os campos, bordas do "entalhe", login no cofre seguro (Keychain) e gestos — comportamentos diferentes do Android. | 3–5 dias |
| B24 | **Empacotamento final (.ipa) e instalação no celular** | Gerar o "instalador" do iPhone assinado e instalar no aparelho do cliente (exige Mac na hora da instalação). | 1–2 dias |
| B25 | **Testes no aparelho real** | Testar no iPhone do cliente cada função: login, tarefas, projetos, calendário, e-mail, rotina, avisos, fotos/anexos. | 3–5 dias |
| B26 | **Correções e versão final** | Ajustar o que apareceu no teste real e gerar o arquivo definitivo. | 1–2 dias |

**Subtotal Fase B: 71 a 118 dias úteis (≈ 3,5 a 6 meses)** —
por se tratar de **construção completa do zero** (sem nada programado para o
iPhone), **+ espera da aprovação da conta Apple**
(1 a 5 dias úteis, fora do prazo do programador) **+ Mac disponível** no
momento da instalação no iPhone (a Apple exige programa de computador da Apple
para instalar o app no aparelho).

> Dica de planejamento: como esta fase é a maior do projeto, começa a valer a
> pena avaliar rodar a fase do iPhone com **2 programadores** (um monta as
> telas/recursos e outro cuida de login, avisos e empacotamento), reduzindo o
> prazo — a estimativa acima considera 1 único programador.

---

### Fase C — Ajustes no servidor (backend)

| # | Etapa (o que é) | Por que importa | Estimativa |
|---|---|---|---|
| C1 | **Correção no instalador automático** — arrumar a etapa que monta o sistema do zero no servidor. | Evita instalações manuais com risco de erro quando o sistema é recriado. | 1–2 dias |
| C2 | **Bloqueio por tentativas de senha errada** — travar a conta após várias tentativas. | Protege o sistema contra invasão por tentativa. | 1–2 dias |
| C3 | **Convite por e-mail + redefinição de senha** — admin convida por e-mail e a pessoa cria a própria senha; recuperar senha esquecida. | Conveniência e segurança para novos usuários. | 3–5 dias |

**Subtotal Fase C: 5 a 9 dias úteis (≈ 1 a 2 semanas)**

---

### Fase D — Ajustes no sistema web (frontend)

| # | Etapa (o que é) | Por que importa | Estimativa |
|---|---|---|---|
| D1 | **Página de Relatórios** — totais e gráficos de desempenho (as contas já funcionam; falta a tela para o cliente enxergá-las). | Monitorar produtividade e atrasos com facilidade. | 3–5 dias |
| D2 | **Tela de Permissões por função** — definir, pelo computador, o que cada função pode fazer (sem exigir programador). | Autonomia do admin para controlar acessos. | 2–4 dias |
| D3 | **E-mail: pastas e anexos** — enviados, rascunho, lixeira, anexar arquivos e busca nas mensagens. | Completar o uso de e-mail dentro do sistema. | 5–8 dias |
| D4 | **Auditoria: filtro por data + exportar CSV** — filtrar histórico por período e baixar em planilha. | Facilita conferências e relatórios para fora do sistema. | 1–2 dias |

**Subtotal Fase D: 11 a 19 dias úteis (≈ 2 a 4 semanas)**

---

### Fase E — Testes e garantia de qualidade

| # | Etapa (o que é) | Por que importa | Estimativa |
|---|---|---|---|
| E1 | **Testes automáticos do coração do sistema** — rotinas que checam login, tarefas e projetos sozinhas. | Evita que correção em um lugar quebre outra parte sem ninguém perceber. | 5–8 dias |
| E2 | **Testes práticos no celular** (Android e iPhone) + correção dos problemas encontrados. | Garantir que tudo funcione no aparelho real, como o cliente vai usar. | 3–5 dias |

**Subtotal Fase E: 8 a 13 dias úteis (≈ 1,5 a 2,5 semanas)**

---

### Fase F — Homologação e entrega final

| # | Etapa (o que é) | Por que importa | Estimativa |
|---|---|---|---|
| F1 | **Teste final junto com o cliente** e ajustes de último momento. | Garantir satisfação e alinhar o que foi pedido. | 2–4 dias |
| F2 | **Entrega** — instalar a versão final no Android e no iPhone + treinar quem vai usar. | Concluir o serviço com uso real. | 1–2 dias |

**Subtotal Fase F: 3 a 6 dias úteis**

---

## 4. Resumo de prazos

| Fase | Prazo mínimo | Prazo máximo |
|---|---|---|
| A — Android (finalização) | 7 dias | 14 dias |
| B — iPhone (construção) | 71 dias | 118 dias |
| C — Servidor (backend) | 5 dias | 9 dias |
| D — Sistema web (frontend) | 11 dias | 19 dias |
| E — Testes | 8 dias | 13 dias |
| F — Homologação e entrega | 3 dias | 6 dias |
| **TOTAL** | **105 dias úteis** | **179 dias úteis** |

Na prática: **5 a 8 meses de trabalho contínuo de 1 programador**.

> Reforço de segurança (recomendado): somar **15% de margem** sobre o total
> para imprevistos (correções, dúvidas, integração com o iPhone),
> chegando a **≈ 6 a 9 meses**.

A Fase B (iPhone) só pode **começar de fato** depois de criada a conta Apple,
então é recomendável abrir essa conta no início do projeto, em paralelo.

---

## 5. Premissas usadas na estimativa

1. **1 único programador**, nível júnior → início de pleno, **sem uso de IA**,
   programando de forma tradicional (escreve, testa, corrige manualmente).
2. Jornada de **6 a 8 horas por dia útil**.
3. A estimativa **já inclui**: escrever o código, testar o que foi feito e
   corrigir erros descobertos no caminho.
4. Não inclui: design de tela novo, espera de aprovação da Apple, custo da
   conta da Apple, nem reuniões extensas.
5. Não foram previstas fases futuras opcionais (ex.: faturamento/assinatura,
   automações avançadas, bloco de "telefonia").

---

## 6. Custos que NÃO são de programação

| Item | Valor estimado | Observação |
|---|---|---|
| **Conta Apple Developer** (anual, obrigatória para instalar no iPhone) | **US$ 99/ano** | Necessária para empacotar e instalar o app no celular real. |
| **Instalação no iPhone** | 0 | Requer um **Mac/notebook da Apple** disponível no dia da instalação. |
| Hospedagem atual | Já em uso | Sem custo novo previsto nesta etapa. |

---

*Documento gerado com base no estado atual do projeto. Revisar prazos quando
houver mudança de escopo.*