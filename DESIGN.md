# DESIGN.md: Swiss Neon

Sistema de design "**Swiss Neon**" do AB Test Calculator. Cobre tokens, padrões de componente, princípios de layout e como construir telas novas sem cair no AI slop.

Quando este doc divergir do código real, **o código vence**. Atualize este arquivo no mesmo PR que mudar tokens, fontes ou patterns globais.

---

## 1. Identidade

Ferramenta de análise estatística para quem decide com dados. **Instrumento de precisão, não app de marketing:** grid suíço, linhas finas de 1px, tipografia grande nos números que importam, zero ornamento. A única concessão à emoção é o neon dos gráficos e do acento, que faz o resultado "acender" na tela.

**Vibe references:**

- Cartazes do Estilo Tipográfico Internacional (Müller-Brockmann): grid rígido, hierarquia só por tamanho e peso
- Brutalismo leve de sites editoriais: réguas de 1px, blocos retangulares, nada de sombra
- Painéis de instrumento (osciloscópio, terminal): densidade alta de números, monoespaçado nos valores
- Neon sobre preto puro no dark: o dado brilha, a interface some

**Dial values:**

- `DESIGN_VARIANCE: 3`: grid rígido e previsível; a variação vem de tamanho de tipo, não de layout
- `MOTION_INTENSITY: 2`: quase estático; só transições de estado curtas (≤ 150 ms)
- `VISUAL_DENSITY: 8`: alta; inputs e resultados visíveis juntos no desktop, cara de instrumento

**Modo de cor:** **light e dark, seguindo o sistema** (`prefers-color-scheme`) na primeira visita. O seletor manual no cabeçalho sobrescreve e fica salvo em `localStorage` (`theme = light | dark`). O tema é aplicado por um script inline no `<head>` que seta `data-theme` no `<html>` antes do primeiro paint (sem flash).

**Regra de forma:** **tudo é reto.** Zero `border-radius` em botões, inputs, cards, badges, tooltips, barras de gráfico e foco. Não existe exceção "só um pouquinho arredondado".

---

## 2. Tokens

Todos os tokens vivem em `src/styles/global.css` como CSS custom properties, por tema (`[data-theme="light"]` e `[data-theme="dark"]`). O Tailwind v4 expõe via `@theme inline`. Componentes usam **só utilities tokenizadas**, nunca hex direto.

### 2.1 Cores de interface

| Token | Light | Dark | Uso |
|---|---|---|---|
| `bg-background` | `#FFFFFF` | `#000000` | Fundo da página. Branco puro / preto puro, sem viés |
| `bg-surface` | `#FAFAFA` | `#0A0A0A` | Blocos de seção quando precisam se destacar do fundo (raro) |
| `text-foreground` | `#0A0A0A` | `#F5F5F5` | Texto primário |
| `text-muted` | `#6B6B6B` (5,3:1) | `#A3A3A3` (8,3:1) | Labels, helper text, unidades |
| `border-rule` | `#E5E5E5` | `#262626` | Réguas de 1px entre seções e linhas de tabela (decorativas) |
| `border-control` | `#8A8A8A` (3,4:1) | `#5C5C5C` (3,1:1) | Borda de input, toggle e segmentado (componente de UI precisa ≥ 3:1) |
| `bg-accent` | `#4284F5` | `#42F5C5` | **Acento único.** Botão primário, segmento ativo, toggle ligado, foco, slot 1 dos gráficos |
| `text-on-accent` | `#000000` (5,9:1) | `#000000` (15,1:1) | Texto sobre o acento. **Preto nos dois temas** (branco sobre `#4284F5` dá 3,6:1 e reprova AA) |
| `text-accent` | `#1F5FD6` (5,7:1) | `#42F5C5` (15,1:1) | Acento usado como texto (links, número em destaque). No light, o `#4284F5` puro não passa AA como texto, então o texto usa um passo mais escuro da mesma matiz |
| `bg-accent-soft` | `#4284F5` a 10% | `#42F5C5` a 12% | Linha selecionada de tabela, semana escolhida no plano |

**Regra de acento:** um acento por tema, e só ele. Hierarquia extra vem de **peso e tamanho de tipo** ou de **opacidade do próprio acento** (`bg-accent/10`, `bg-accent/20`), nunca de uma segunda cor de UI. As cores neon dos gráficos (2.2) não vazam para a interface.

### 2.2 Paleta dos gráficos (categórica, neon)

Uma cor por grupo, atribuída **na ordem fixa dos slots e presa à entidade**: o Controle é sempre o slot 1, a Variante B sempre o slot 2, e assim por diante. Remover a Variante C não repinta a D.

| Slot | Grupo | Light | OKLCH (L C H) | Dark | OKLCH (L C H) |
|---|---|---|---|---|---|
| 1 | Controle | `#4284F5` azul | 0,63 0,18 260 | `#42F5C5` menta | 0,87 0,16 170 |
| 2 | Variante B | `#E8007A` magenta | 0,60 0,24 0 | `#FF3DF0` rosa neon | 0,71 0,29 332 |
| 3 | Variante C | `#8A3DFF` violeta | 0,57 0,26 295 | `#F5E642` amarelo neon | 0,91 0,17 104 |
| 4 | Variante D | `#00A87E` verde-água | 0,65 0,13 167 | `#4D8BFF` azul elétrico | 0,65 0,18 262 |
| 5 | Variante E | `#F05A00` laranja | 0,66 0,20 42 | `#FF7A3D` laranja neon | 0,73 0,18 43 |

**Validação (rodada em 20/10/2026 com o validador de paleta, CVD por Machado 2009, pares adjacentes):**

| Check | Light (fundo `#FFFFFF`) | Dark (fundo `#000000`) |
|---|---|---|
| Faixa de luminosidade | Passa (L 0,57 a 0,66) | **Exceção registrada** (L 0,65 a 0,91; faixa padrão é 0,48 a 0,67) |
| Croma mínimo (≥ 0,10) | Passa | Passa |
| Separação para daltonismo (alvo ΔE ≥ 8) | Passa, pior par ΔE 12,3 | Passa, pior par ΔE 20,5 |
| Visão normal (ΔE ≥ 15) | Passa, pior par 27,7 | Passa, pior par 35,0 |
| Contraste com o fundo (≥ 3:1) | Passa | Passa |

> **Exceção do dark:** o briefing pede neon sobre preto puro, e neon é, por definição, mais claro que a faixa padrão de luminosidade. A faixa existe para que nenhuma série "pese" mais que outra; aceitamos a diferença porque todas as séries ficam muito acima do contraste mínimo e a separação para daltonismo é a mais folgada das duas paletas. Toda nova cor do dark ainda precisa passar nos outros quatro checks.

**Regras de uso:**

- Texto nunca usa a cor da série: valores, labels e legenda ficam em `text-foreground` / `text-muted`; um marcador quadrado colorido ao lado carrega a identidade.
- Com 2 ou mais grupos, legenda sempre presente; até 4 grupos, também rótulo direto no fim de cada curva/barra.
- Gráficos de dispersão ou small multiples (onde quaisquer duas cores se tocam) não são usados no v1. Se entrarem, revalidar com todos os pares.
- Adicionar um 6º grupo não é permitido (PRD limita a 5).

### 2.3 Cores de status (reservadas)

Usadas só em alertas, achados e veredito. **Sempre com ícone + rótulo**, nunca cor sozinha. Não aparecem nos gráficos como série.

| Token | Light | Dark | Uso |
|---|---|---|---|
| `status-critical` | `#D92D20` (4,8:1) | `#FF5A4F` (6,8:1) | Achados críticos (SRM, peeking), veredito Perdedora, receita negativa |
| `status-warning` | `#B54708` (5,4:1) | `#FFB020` (11,5:1) | Achados de atenção (poucos dados, sem poder, MDE > 10%) |
| `status-info` | `text-muted` | `text-muted` | Achados informativos (semanas incompletas, métodos discordam) |
| Vencedora | `bg-accent` + `text-on-accent` | idem | Veredito positivo usa o próprio acento, não um verde extra |

### 2.4 Tipografia

**Família única:** `Geist` (sans) para texto e `Geist Mono` para **todo número métrico** (inputs numéricos, resultados, tabelas, eixos). Auto-hospedadas, subconjunto latino, `font-display: swap`.

| Variável CSS | Fonte |
|---|---|
| `--font-sans` | Geist |
| `--font-mono` | Geist Mono |

**Escala (desktop; mobile reduz só os dois primeiros níveis):**

| Nível | Classes | Uso |
|---|---|---|
| Número herói | `font-mono text-[56px] font-medium leading-none tracking-[-0.04em] tabular-nums` | P(vencer), lift ou MDE principal do veredito |
| Título de página | `text-[32px] font-semibold leading-[1.05] tracking-[-0.03em]` | "Análise do teste", "Pré-teste" |
| Título de seção | `text-[18px] font-semibold tracking-[-0.01em]` | "1. Duração", "Resultados" |
| Valor de célula | `font-mono text-[20px] font-medium tabular-nums` | Stat cells (CR, p-value, risco) |
| Corpo | `text-[14px] leading-[1.45]` | Frases-manchete, explicações, TL;DR |
| Label | `text-[12px] font-medium text-muted` | Rótulos de input e de stat |
| Rótulo técnico | `text-[11px] font-medium uppercase tracking-[0.08em] text-muted` | Cabeçalho de coluna de tabela, eixo de gráfico. **Não usar como eyebrow decorativo** |
| Número de tabela | `font-mono text-[13px] tabular-nums` | Tabelas de MDE, fronteiras, fórmulas |

- No número herói, o separador decimal ocupa 0,28em com tracking zero. Os dígitos mantêm o tracking −0,04em. Evita espaços aparentes ao redor da vírgula na Geist Mono.
- `tabular-nums` em **todo** número que muda com o input (evita "dança" de largura a cada tecla).
- Risco em p.p. mantém duas casas por padrão e pelo menos dois dígitos significativos abaixo de 0,1 p.p. Um risco não nulo nunca aparece arredondado para zero.
- Alinhamento de números em tabela: à direita. Texto: à esquerda.
- Sem itálico, sem caixa alta em frases inteiras.

### 2.5 Espaçamento e grid

| Token | Valor | Uso |
|---|---|---|
| Unidade base | 4 px | Toda medida é múltiplo de 4 |
| Gap de controle | 8 px | Entre label e input; entre botões de um grupo segmentado (0 px, ver 3.3) |
| Gap de bloco | 16 px | Entre campos de um passo |
| Gap de seção | 32 px | Entre passos (1, 2, 3, 4), separados por régua de 1px |
| Grid | 12 colunas, gutter 24 px, largura máxima 1280 px, margem lateral 32 px (16 px no mobile) | |

### 2.6 Bordas, radius e sombras

- **Radius: `0` em tudo.** O `@theme` zera a escala (`--radius-*: 0`), então `rounded-*` não tem efeito; mesmo assim, não escrever.
- **Bordas:** 1 px. `border-rule` para separar, `border-control` para delimitar controles interativos. Ênfase usa 2 px de `bg-accent` (ex.: borda esquerda do card de veredito), nunca sombra.
- **Sombras: nenhuma.** Elevação (tooltip, toast) é indicada por borda de 1 px `border-control` e fundo `bg-background`.
- **Foco:** `outline: 2px solid var(--accent); outline-offset: 2px;` reto, sempre visível com teclado (`:focus-visible`).

### 2.7 Motion

- Transições de cor e opacidade: 120 ms, `ease-out`.
- Recalculo de gráficos: transição de path ≤ 150 ms; sem animação de entrada.
- Acordeão de explicação: altura instantânea, conteúdo com fade de 120 ms.
- Tudo dentro de `motion-safe:`; com `prefers-reduced-motion`, zero transição.
- Proibido: hover lift, scale, bounce, spring, skeleton shimmer.

---

## 3. Patterns de componentes

Os componentes são ilhas **Preact** dentro de páginas **Astro**. Código de referência em TSX (Preact com `class`).

### 3.1 Cabeçalho da calculadora

Faixa única no topo, separada por régua de 1 px. À esquerda, a marca em texto; no centro, as abas como links de rota (são páginas, PRD seção 2); à direita, idioma, tema e o botão de compartilhar. Aba ativa = sublinhado de 2 px no acento, não fundo preenchido.

```tsx
<header class="sticky top-0 z-20 border-b border-rule bg-background">
  <div class="mx-auto flex h-14 max-w-[1280px] items-center gap-8 px-8">
    <a href={`/${locale}/${slugs.analysis}`} class="text-[14px] font-semibold tracking-[-0.01em]">
      AB Test Calculator
    </a>
    <nav class="flex h-full gap-6" aria-label={t("nav.label")}>
      {tabs.map((tab) => (
        <a
          href={tab.href + location.hash}
          aria-current={tab.active ? "page" : undefined}
          class="flex h-full items-center border-b-2 border-transparent text-[14px] text-muted transition-colors aria-[current=page]:border-accent aria-[current=page]:text-foreground hover:text-foreground"
        >
          {tab.label}
        </a>
      ))}
    </nav>
    <div class="ml-auto flex items-center gap-2">
      <LocaleSwitch />
      <ThemeSwitch />
      <ShareButton />
    </div>
  </div>
</header>
```

### 3.2 Botões

Três níveis. Todos retos, altura fixa, texto em `14px font-medium`.

- **Primário:** fundo de acento, texto preto. Um por região de tela no máximo ("Gerar TL;DR", "Usar esse plano").
- **Secundário:** contorno de 1 px `border-control`, fundo transparente ("Salvar e compartilhar link", "+ Adicionar variante").
- **Fantasma:** só texto, sublinhado no hover ("Limpar", "Preencher com dados de exemplo", "ver detalhes").

```tsx
const base =
  "inline-flex h-10 items-center justify-center gap-2 px-4 text-[14px] font-medium transition-colors motion-safe:duration-[120ms] disabled:cursor-not-allowed disabled:opacity-40";

const variants = {
  primary: `${base} bg-accent text-on-accent hover:bg-accent/85`,
  secondary: `${base} border border-control text-foreground hover:border-foreground`,
  ghost: `${base} px-0 text-foreground underline-offset-4 hover:underline`,
};

export function Button({ variant = "secondary", ...props }) {
  return <button type="button" class={variants[variant]} {...props} />;
}
```

### 3.3 Controle segmentado

Para escolhas fixas: confiança 90/95/99, poder 80/90, uni/bicaudal, Bayesiano/Z test, Modo A/B, horizonte de receita, moeda. Segmentos colados (gap 0) com uma única borda externa; o ativo recebe o acento preenchido. É um `radiogroup` acessível.

```tsx
export function Segmented({ label, options, value, onChange }) {
  return (
    <fieldset class="flex flex-col gap-2">
      <legend class="text-[12px] font-medium text-muted">{label}</legend>
      <div role="radiogroup" class="inline-flex border border-control">
        {options.map((opt) => (
          <button
            type="button"
            role="radio"
            aria-checked={opt.value === value}
            onClick={() => onChange(opt.value)}
            class="h-9 border-r border-control px-3 font-mono text-[13px] tabular-nums last:border-r-0 aria-checked:bg-accent aria-checked:text-on-accent"
          >
            {opt.label}
          </button>
        ))}
      </div>
    </fieldset>
  );
}
```

### 3.4 Input numérico

Label em cima, campo com borda de 1 px, valor em mono alinhado à direita, unidade como sufixo fixo dentro do campo (`%`, `dias`, `R$`). Erro troca a borda para `status-critical` e mostra a mensagem embaixo com ícone. Aceita o separador decimal do locale (PRD seção 17).

```tsx
export function NumberField({ id, label, unit, value, error, onInput }) {
  return (
    <div class="flex flex-col gap-2">
      <label for={id} class="text-[12px] font-medium text-muted">{label}</label>
      <div
        class="flex h-10 items-center border border-control bg-background focus-within:outline focus-within:outline-2 focus-within:outline-offset-2 focus-within:outline-accent data-[error]:border-status-critical"
        data-error={error ? "" : undefined}
      >
        <input
          id={id}
          inputMode="decimal"
          value={value}
          onInput={onInput}
          aria-invalid={!!error}
          aria-describedby={error ? `${id}-error` : undefined}
          class="h-full w-full bg-transparent px-3 text-right font-mono text-[14px] tabular-nums outline-none"
        />
        {unit && <span class="pr-3 font-mono text-[13px] text-muted">{unit}</span>}
      </div>
      {error && (
        <p id={`${id}-error`} class="flex items-center gap-1 text-[12px] text-status-critical">
          <IconWarning class="size-3.5" aria-hidden /> {error}
        </p>
      )}
    </div>
  );
}
```

### 3.5 Tabela de grupos (dados do teste)

Na densidade alta, os grupos não são cards: são **linhas de tabela** com inputs embutidos. Coluna 1 é o marcador quadrado da cor do slot (identidade do grupo nos gráficos) e o nome editável; depois usuários, conversões, split pretendido e as saídas calculadas (CR, lift, p-value ou P(vencer)). A linha do controle não tem botão de remover. "+ Adicionar variante" é uma linha fantasma no fim, até 5 grupos.

Na coluna de inputs de 5/12, cada grupo se reorganiza num bloco compacto da tabela. Nome e remoção ficam na primeira linha; usuários, conversões e split na segunda; CR, lift e p-value ou P(vencer) na terceira. Os rótulos ficam visíveis e nenhum campo exige rolagem horizontal em 1440 px. Em mobile, os mesmos campos usam duas colunas. Ajuste de densidade registrado em 20/10/2026.

```tsx
<table class="w-full border-collapse text-[13px]">
  <thead>
    <tr class="border-b border-rule text-left text-[11px] font-medium uppercase tracking-[0.08em] text-muted">
      <th class="py-2 font-medium">{t("groups.name")}</th>
      <th class="py-2 text-right font-medium">{t("groups.users")}</th>
      <th class="py-2 text-right font-medium">{t("groups.conversions")}</th>
      <th class="py-2 text-right font-medium">{t("groups.split")}</th>
      <th class="py-2 text-right font-medium">CR</th>
      <th class="py-2 text-right font-medium">{t("groups.lift")}</th>
      <th class="py-2 text-right font-medium">{methodColumnLabel}</th>
      <th class="w-8" />
    </tr>
  </thead>
  <tbody>
    {groups.map((g, i) => (
      <tr class="border-b border-rule">
        <td class="py-2">
          <span class="flex items-center gap-2">
            <span class="size-2.5 shrink-0" style={{ background: `var(--series-${i + 1})` }} aria-hidden />
            <InlineText value={g.name} />
          </span>
        </td>
        {/* inputs numéricos compactos (h-8) e células calculadas em font-mono tabular-nums text-right */}
      </tr>
    ))}
  </tbody>
</table>
```

### 3.6 Stat cell

Bloco mínimo de resultado: label técnico em cima, valor mono grande, nota opcional embaixo. Stats ficam em linha, separados por réguas verticais de 1 px, **não** em caixas iguais lado a lado. O stat principal do veredito usa o nível "número herói"; os demais, "valor de célula".

```tsx
export function Stat({ label, value, note, hero = false }) {
  return (
    <div class="flex flex-col gap-1 border-l border-rule pl-4 first:border-l-0 first:pl-0">
      <span class="text-[11px] font-medium uppercase tracking-[0.08em] text-muted">{label}</span>
      <span
        class={
          hero
            ? "font-mono text-[56px] font-medium leading-none tracking-[-0.04em] tabular-nums"
            : "font-mono text-[20px] font-medium tabular-nums"
        }
      >
        {value}
      </span>
      {note && <span class="text-[12px] text-muted">{note}</span>}
    </div>
  );
}
```

### 3.7 Veredito por variante

Bloco com régua esquerda de 2 px na cor do estado, selo do estado, frase-manchete e a linha de stats. Os quatro estados do PRD (seção 8):

| Estado | Régua e selo | Ícone |
|---|---|---|
| Vencedora | `bg-accent`, selo preenchido acento + texto preto | `ph:trend-up` |
| Perdedora | `status-critical`, selo com contorno crítico | `ph:trend-down` |
| Inconclusiva, sem diferença relevante | `border-control`, selo com contorno neutro | `ph:equals` |
| Inconclusiva, sem poder | `status-warning`, selo com contorno de atenção | `ph:hourglass` |

Com `srm` ativo, um segundo selo "não confiável até resolver o SRM" aparece ao lado, em crítico.

```tsx
<section class="border-l-2 pl-4" style={{ borderColor: verdictColor[state] }} aria-labelledby={`v-${id}`}>
  <div class="flex items-center gap-2">
    <VerdictBadge state={state} />
    <h3 id={`v-${id}`} class="text-[14px] font-semibold">{group.name}</h3>
  </div>
  <p class="mt-2 max-w-[64ch] text-[14px] leading-[1.45]">{headline}</p>
  <div class="mt-4 flex flex-wrap gap-6">{/* <Stat hero /> + stats secundários */}</div>
</section>
```

**Selo (badge):** retângulo de `h-6 px-2`, `text-[12px] font-medium`, ícone 14 px à esquerda. Preenchido só para Vencedora; os outros estados usam contorno de 1 px na cor do estado.

### 3.8 Linha de alerta / achado

Usada para as checagens determinísticas (PRD seção 8) e para os achados da IA (seção 11). Uma linha por achado, ordenadas por severidade: ícone + rótulo de severidade, título, explicação, ação. Achados de origem `ai` recebem o selo "apontado pela IA" em contorno neutro.

```tsx
const severityIcon = { critical: IconWarningOctagon, warning: IconWarning, info: IconInfo };

export function FindingRow({ finding }) {
  const Icon = severityIcon[finding.severity];
  return (
    <li class="grid grid-cols-[20px_1fr] gap-x-3 border-b border-rule py-3">
      <Icon class={`mt-0.5 size-4 text-status-${finding.severity}`} aria-hidden />
      <div class="flex flex-col gap-1">
        <p class="flex flex-wrap items-center gap-2 text-[14px] font-semibold">
          <span class={`text-[11px] font-medium uppercase tracking-[0.08em] text-status-${finding.severity}`}>
            {t(`severity.${finding.severity}`)}
          </span>
          {finding.title}
          {finding.source === "ai" && <Tag>{t("finding.fromAi")}</Tag>}
        </p>
        <p class="max-w-[72ch] text-[14px] leading-[1.45]">{finding.explanation}</p>
        <p class="text-[13px] text-muted">{finding.action}</p>
      </div>
    </li>
  );
}
```

### 3.9 Bloco de TL;DR (IA)

Bloco com borda de 1 px `border-control`. Estados (ROUTES.md): **vazio** (texto curto + botão primário "Gerar TL;DR"), **gerando** (botão desabilitado com rótulo "Gerando…" e barra fina de 2 px em acento que percorre a largura; sem spinner circular), **pronto** (TL;DR em corpo 16 px, lista de achados 3.8, rodapé "Gerado por IA em <data>"), **desatualizado** (conteúdo a 40% de opacidade, selo "Dados mudaram" e botão "Gerar de novo" por cima), **fallback** (achados das regras com textos-padrão + aviso em `status-warning`).

O TL;DR é a única peça de texto em 16 px na tela: é o resumo que a pessoa vai ler primeiro depois do número herói.

### 3.10 Acordeão de explicação

Gatilho "?" de 20 × 20 px com contorno de 1 px ao lado do controle, ou link fantasma "o que é isso?". Abre no lugar, empurrando o conteúdo, com fundo `bg-surface` e régua esquerda de 2 px no acento. Camada 1 (leigo) sempre visível ao abrir; "ver detalhes" revela a camada 2 com fórmulas em `font-mono text-[13px]`. Trechos dinâmicos com os números do usuário em `text-accent` mono. Implementado com `<details>`/`<summary>` (funciona sem JS e é acessível por padrão).

```tsx
<details class="group border-l-2 border-accent bg-surface px-4 py-3 open:mt-2">
  <summary class="cursor-pointer list-none text-[13px] font-medium">{t("explain.bayes.title")}</summary>
  <p class="mt-2 max-w-[68ch] text-[14px] leading-[1.45]">{layer1}</p>
  <details class="mt-2">
    <summary class="cursor-pointer text-[13px] underline underline-offset-4">{t("explain.more")}</summary>
    <div class="mt-2 max-w-[68ch] text-[14px] leading-[1.45]">{layer2}</div>
  </details>
</details>
```

### 3.11 Toggle

Para Bonferroni e "teste em andamento". Retângulo de 36 × 20 px com borda de 1 px e um quadrado interno de 14 px que vai para a direita quando ligado; ligado = fundo acento. `role="switch"` com `aria-checked`. Rótulo à direita, explicação "?" ao lado.

### 3.12 Tabela de dados (MDE, fronteiras, fórmulas)

Tabela técnica: cabeçalho com rótulo técnico, linhas com régua inferior de 1 px, números mono à direita. Linha selecionada (semana do plano) com `bg-accent-soft` e régua esquerda de 2 px em acento. Linha com alerta (MDE > 10%) com ícone de atenção na última coluna, não fundo colorido.

### 3.13 Toast e aviso de topo

- **Toast "Link copiado":** canto inferior direito, borda de 1 px `border-control`, fundo `bg-background`, some em 2 s. Sem sombra.
- **Aviso de topo** (link inválido, rascunho substituído): faixa de largura total abaixo do cabeçalho, régua inferior em `status-warning`, botão fantasma "fechar".

### 3.14 Moldura de gráfico

Todo gráfico vive numa moldura padrão: título (nível "título de seção"), legenda em linha acima do plot (marcador quadrado + nome), o plot em SVG, e um link fantasma "ver tabela" que alterna para a tabela equivalente (PRD seção 10). Ver seção 6 para as specs de marca.

---

## 4. Ícones

- **Biblioteca:** Phosphor, via `unplugin-icons` com a coleção `@iconify-json/ph`. Os ícones são compilados como SVG inline no build: **zero JS de runtime** para ícones.
- **Peso:** `regular` na interface; `bold` só dentro de selos de veredito.
- **Tamanhos:** 14 px em selos e mensagens de erro, 16 px em linhas de achado e botões, 20 px no cabeçalho.
- **Cor:** herda `currentColor`. Ícone de status usa o token de status correspondente.
- Ícones decorativos sempre com `aria-hidden`.

| Uso | Ícone |
|---|---|
| Crítico | `ph:warning-octagon` |
| Atenção | `ph:warning` |
| Info | `ph:info` |
| Vencedora / Perdedora | `ph:trend-up` / `ph:trend-down` |
| Sem diferença / Sem poder | `ph:equals` / `ph:hourglass` |
| Compartilhar | `ph:link-simple` |
| Tema | `ph:sun` / `ph:moon` |
| Explicação | `ph:question` |
| Adicionar / remover grupo | `ph:plus` / `ph:x` |
| IA | `ph:sparkle` (só no botão "Gerar TL;DR" e no selo "apontado pela IA") |

---

## 5. Layout

### 5.1 Padrão de página (desktop)

Grid de 12 colunas, largura máxima 1280 px.

| Página | Colunas 1 a 5 | Colunas 6 a 12 |
|---|---|---|
| Análise do teste | Passos 1 (duração) e 2 (tabela de grupos), configurações compartilhadas | Passo 4 (resultados): seletor de método, vereditos, alertas, TL;DR, gráficos. **Sticky** a partir do topo enquanto o usuário edita à esquerda |
| Pré-teste | Inputs, seletor de modo, plano de espiadas, botão "Usar esse plano" | Tabela de MDE (Modo A) ou amostra e duração (Modo B), curva MDE x semanas, fronteiras sequenciais |

O passo 3 (detalhes e calculadoras) ocupa as 12 colunas abaixo, recolhido por padrão.

### 5.2 Mobile (< 768 px)

Uma coluna. Ordem: inputs, depois resultados. Um botão fixo no rodapé "Ver resultado ↓" rola até o veredito quando os inputs estão válidos. A tabela de grupos vira lista de blocos (um por grupo, com os mesmos campos empilhados), mantendo o marcador de cor.

### 5.3 Hierarquia visual

1. Número herói do veredito (o que a pessoa veio buscar).
2. Frase-manchete e TL;DR.
3. Alertas críticos.
4. Gráficos.
5. Detalhes e fórmulas.

Seções separadas por régua de 1 px e numeradas como no Speero ("1. Duração do teste"), porque a numeração aqui é um passo real do fluxo, não decoração.

### 5.4 Elementos sticky

- Cabeçalho (sempre).
- Coluna de resultados no desktop.
- Botão "Ver resultado" no mobile.

---

## 6. Gráficos (specs de marca)

Todos em **SVG próprio** (sem biblioteca), renderizados por componentes Preact. Ajustes ao padrão geral de dataviz por causa da regra de forma reta:

| Elemento | Spec |
|---|---|
| Linhas e curvas | 2 px, `stroke-linejoin: miter`, sem pontas arredondadas |
| Áreas (densidade, região de IC, área > 0 do lift) | Preenchimento da cor do slot a 18% de opacidade + contorno de 2 px |
| Barras (intervalos do lift) | 8 px de altura, **pontas retas** (exceção deliberada ao arredondamento de 4 px do padrão de dataviz), 2 px de espaço de fundo entre barras vizinhas |
| Marcadores | Quadrados de 8 px (não círculos), com anel de 2 px da cor do fundo quando sobrepostos |
| Linha do zero / limiar 10% | 1 px tracejada `4 4` em `text-muted` |
| Zona de alerta (MDE > 10%) | Faixa com `status-warning` a 8% de opacidade e rótulo "acima de 10%" |
| Grade | Só horizontal, 1 px `border-rule` |
| Eixos | Rótulo técnico (11 px, caixa alta), números mono 11 px, `text-muted` |
| Rótulos diretos | No fim de cada série, em `text-foreground`, até 4 séries |
| Hover | Linhas e curvas: crosshair vertical de 1 px + tooltip com o valor de todas as séries naquele x. Barras: tooltip por barra. Alvo de hover maior que a marca (mínimo 24 px). Tooltip reto, borda de 1 px, fundo `bg-background`, números mono |
| Acessibilidade | `role="img"` com `aria-label` descritivo + link "ver tabela" com a tabela equivalente |

---

## 7. Anti-slop checklist

Antes de commitar, valide:

- [ ] **Zero `border-radius`** em qualquer elemento, incluindo foco, tooltip, barra de gráfico e selo.
- [ ] **Um único acento de UI** (`#4284F5` light / `#42F5C5` dark). Cores neon só dentro de gráficos e nos marcadores de grupo.
- [ ] **Texto sobre o acento é preto** nos dois temas.
- [ ] **Texto em acento no light usa `text-accent` (`#1F5FD6`)**, nunca o `#4284F5` puro.
- [ ] **Cores dos grupos presas ao slot**: remover uma variante não repinta as outras.
- [ ] **Status sempre com ícone + rótulo**; nenhum estado comunicado só por cor.
- [ ] **`tabular-nums` + `font-mono`** em todo número métrico, inclusive dentro de inputs.
- [ ] **Zero sombra.** Elevação só por borda.
- [ ] **Stats não são caixas iguais lado a lado**; usam réguas e o número herói se destaca.
- [ ] **Nenhum spinner circular nem skeleton shimmer**; carregamento é a barra fina de 2 px.
- [ ] **Light e dark testados** na mesma tela antes do PR (inclusive os gráficos).
- [ ] **Foco visível** por teclado em todo controle.
- [ ] **Contraste:** texto ≥ 4,5:1, controles e marcas de gráfico ≥ 3:1 (tabela 2.1).
- [ ] **`motion-safe:`** em toda transição; nada se mexe com movimento reduzido.
- [ ] **Zero travessão (`—`) em texto visível.** O "—" como placeholder de valor vazio nos resultados é a única exceção (é um símbolo de dado ausente, herdado do Speero).
- [ ] **Todo gráfico tem legenda (2+ grupos), hover e "ver tabela".**

---

## 8. Como criar uma tela nova

1. **Página Astro** em `src/pages/[locale]/<slug>.astro`, com os slugs traduzidos registrados em `src/i18n/routes.ts` (ver ROUTES.md).
2. **Layout base** `src/layouts/Calculator.astro` (cabeçalho, rodapé, script de tema, Umami).
3. **Conteúdo estático** (títulos, textos, explicações camada 1) renderizado no Astro: chega pronto no HTML.
4. **Interatividade** só como ilha Preact (`client:load` para a calculadora; `client:visible` para gráficos).
5. **Grid 5 + 7** no desktop (seção 5.1), uma coluna no mobile.
6. Reaproveitar os patterns da seção 3; só criar componente novo se nenhum servir.
7. Rodar o checklist da seção 7 e o build antes do PR.

### Smoke test rápido

```bash
pnpm build && pnpm preview
curl -s -o /dev/null -w "%{http_code}\n" http://localhost:4321/pt/analise
```

Deve retornar `200`. Conferir também `/en/analysis`, `/pt/pre-teste`, `/en/pre-test` e o redirect de `/`.

---

## 9. Como criar um componente novo

### Quando criar vs inline

- **Inline:** uso único, menos de 50 linhas.
- **Componente em `src/components/<nome>.tsx`:** reusado em 2 ou mais lugares, ou mais de 80 linhas isolado.
- **Lógica estatística nunca mora em componente.** Vai para o motor em `src/stats/` (funções puras, testadas isoladamente; PRD seção 16).

### Estrutura de arquivo padrão

```tsx
// src/components/stat.tsx
type StatProps = {
  label: string;
  value: string;
  note?: string;
  hero?: boolean;
};

export function Stat({ label, value, note, hero = false }: StatProps) {
  // ver pattern 3.6
}
```

**Princípios:**

- Preact com `class` (não `className`), props tipadas.
- Variantes por prop (`variant`, `hero`), não por componentes duplicados.
- Strings sempre do catálogo de i18n, nunca literais no JSX.
- Tokens, nunca hex.
- Números formatados por um helper único `formatNumber(value, { locale, kind })` (`kind`: `percent`, `pp`, `integer`, `currency`, `pvalue`), para que a mesma grandeza apareça igual em toda a tela.

---

## 10. Tooling

### Stack

- **Astro** (saída estática, uma página pré-gerada por idioma e aba), publicado no **Cloudflare Workers com Static Assets**
- **Preact** para as ilhas interativas (calculadora, gráficos, TL;DR)
- **Tailwind v4** com `@theme inline` em `src/styles/global.css`
- **Geist + Geist Mono** auto-hospedadas (subconjunto latino)
- **Phosphor** via `unplugin-icons` + `@iconify-json/ph` (SVG inline no build)
- **Gráficos em SVG próprio** (sem biblioteca)
- **Turnstile** (widget da Cloudflare) só no momento de gerar o TL;DR
- **Umami Cloud** (script assíncrono)

### Setup local

```bash
pnpm dev          # localhost:4321
pnpm test         # testes do motor estatístico
pnpm build        # build estático + checagem de tipos
pnpm preview      # serve o build como no Worker
```

### Quando adicionar dependência nova

Antes de `pnpm add <pacote>`:

1. **O orçamento é 150 KB de JS gzip no total** (PRD seção 18). Medir o impacto com o relatório de build antes de aceitar.
2. **Cheque se Tailwind, Phosphor ou o próprio Preact já cobrem.** Quase sempre cobrem.
3. **Nada de biblioteca de componentes** (shadcn, Radix, MUI): os patterns da seção 3 são pequenos e retos; bibliotecas trazem radius e sombra para desfazer.
4. **Nada de biblioteca de gráficos.** Se um gráfico novo parecer exigir uma, discutir antes.
5. **Biblioteca estatística** só se for pura, pequena e com fonte verificável; preferir implementar a fórmula do PRD com teste.

---

## 11. O que NÃO fazer (lista negra do AI slop)

- ❌ `rounded-*`, pílulas, cantos "suaves". O sistema é reto
- ❌ Sombras de qualquer tipo, inclusive "sombra colorida sutil"
- ❌ Gradiente roxo-rosa ou qualquer gradiente decorativo
- ❌ Glow, blur, glassmorphism atrás do neon
- ❌ Segunda cor de acento na interface (as cores neon são só dos gráficos)
- ❌ Texto branco sobre `#4284F5`
- ❌ Cards idênticos lado a lado para stats
- ❌ Eyebrow decorativo em caixa alta sobre cada seção (caixa alta só em cabeçalho de tabela e eixo)
- ❌ Ícone de "sparkle" de IA espalhado pela interface (só no botão de gerar e no selo de achado da IA)
- ❌ Spinner circular, skeleton shimmer, confete ao achar uma vencedora
- ❌ Hover lift, scale, bounce
- ❌ Ilustração, mascote, foto de banco de imagens, mockup falso de dashboard
- ❌ Gráfico com dois eixos Y
- ❌ Cor de série no texto (valores e legendas ficam em `text-foreground` / `text-muted`)
- ❌ Barras com ponta arredondada nos gráficos
- ❌ Fonte que não seja Geist / Geist Mono
- ❌ Número métrico em fonte proporcional

---

## 12. Roadmap visual

Nenhuma tela construída ainda. Ordem sugerida de aplicação do sistema:

- 🟡 Tokens, fontes, script de tema e layout base (`src/styles/global.css`, `src/layouts/Calculator.astro`)
- 🟡 Patterns 3.2 a 3.4, 3.11 (botão, segmentado, input, toggle)
- 🟡 `/pt/analise` · `/en/analysis`: tabela de grupos, veredito, stats, alertas
- 🟡 Gráficos do pós-teste (seção 6)
- 🟡 Bloco de TL;DR em todos os estados
- 🟡 `/pt/pre-teste` · `/en/pre-test`: tabela de MDE, curva, fronteiras
- 🟡 Acordeões de explicação
- 🟡 `/pt/sobre` · `/en/about`
- 🟡 Página 404

Para cada uma: aplicar o checklist da seção 7 em light e dark.
