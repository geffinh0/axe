# Axé — os filhos de santo contra os Ajogun

Roguelite tático por turnos, curto e rejogável, inspirado na **Umbanda** e na **cosmologia iorubá**.

Os Ajogun — as forças da desordem — romperam o caminho entre o Orun e o Aiyê, e Ikú, a Morte, vem buscar a aldeia antes da hora. Você é um filho de santo que carrega o axé do seu orixá e precisa fechar **seis terreiros** até enfrentar Ikú. Uma jornada dura de 10 a 15 minutos.

## Como jogar

Abra o `index.html` em qualquer navegador moderno (não precisa de servidor, instalação nem internet). Para servir na rede local: `python3 -m http.server 8080` e acesse `http://localhost:8080`.

| Ação | Teclado | Toque / mouse |
| --- | --- | --- |
| Andar / golpear | setas ou WASD | casas vizinhas |
| Habilidade | Espaço ou Q (mira e confirma) | botão da habilidade + casa alvo |
| Esperar uma rodada | E | botão Esperar |
| Cancelar / pausar | Esc | botão ❚❚ |
| Som | M | botão ♪ |

### O ciclo de uma jornada

1. **Escolha** um filho de santo (e, depois da primeira vitória, provações que multiplicam a pontuação).
2. **Terreiro**: você age, depois todos os inimigos agem. Todo ataque inimigo é **anunciado uma rodada antes** com casas vermelhas — saia delas ou derrote quem vai atacar.
3. **Fogo amigo**: ataques dos Ajogun ferem qualquer um nas casas marcadas, inclusive outros Ajogun. Empurrões contra pedras, criaturas e o rio também ferem. Boa parte da graça é fazer os inimigos se destruírem.
4. **Ondas**: cada terreiro tem 2 ou 3 ondas, anunciadas por marcas roxas no chão. A próxima chega quando a atual cai ou quando o tempo acaba.
5. **Encruzilhada**: entre terreiros, Exu abre os caminhos — escolha uma de três **dádivas** ou um Banho de Ervas (+2 de vida).
6. **Ikú**: no sexto terreiro, a Morte atravessa o campo em linhas, lança sentenças e chama kiumbas. Depois de cada travessia fica atordoada e o próximo golpe dobra.
7. **Resultado**: pontuação detalhada, nota (S a D), lição sobre o que derrotou você, recordes e marcas conquistadas — e "Tentar de novo".

## Conteúdo

- **4 filhos de santo**, cada um com passiva e habilidade próprias:
  - **Kayode, filho de Ogum** — golpe que empurra; *Abre-Caminho* (investida que arremessa).
  - **Ayo, filha de Oxóssi** — golpe que atravessa; *Flecha Certeira* (tiro de longo alcance).
  - **Tunde, filho de Xangô** — golpe que incendeia e imunidade ao fogo; *Pedra de Raio* (área em cruz que deixa o chão em chamas).
  - **Folake, filha de Iansã** — raio que salta entre inimigos; *Ventania* (empurra tudo ao redor). Liberada ao vencer a jornada uma vez.
- **9 criaturas** com comportamentos distintos: Kiumba, Zombeteiro e Obsessor (kiumbas da Umbanda) e os Ajogun Òfò (perda), Òràn (encrenca), Àrùn (doença), Èpè (maldição), Ègbà (paralisia) e Ikú (a morte).
- **4 biomas**: Mata Sagrada, Beira do Rio, Pedreira de Xangô e Calunga — cada um com obstáculos, perigos e trilha sonora próprios.
- **16 dádivas** que se combinam (ex.: Pedreira + rio, Ligeireza de Oyá + Fio de Ogum, Rastro de Pólvora + imunidade ao fogo).

## Por que jogar de novo

- **Terreiros gerados por semente**: mapas, ondas e ofertas de dádivas mudam a cada jornada.
- **Recordes e notas** por herói, com pontuação que recompensa rapidez, terreiros sem dano e truques (fogo amigo, rio, batidas).
- **Provações** (liberadas após a primeira vitória): Horda dos Ajogun, Corpo Frágil, Chuva de Brasa e Couro Grosso — combináveis, cada uma muda a estratégia e multiplica o axé.
- **Desafio do Dia**: mesma semente, herói e provação para todo mundo naquele dia.
- **11 marcas** (objetivos secundários), **bestiário** que se preenche ao encontrar criaturas e **histórico** das últimas jornadas.
- **Semente escolhida** (opções avançadas) para repetir ou compartilhar um caminho.

## Salvamento

Tudo fica no `localStorage` do navegador: configurações, recordes, marcas, desbloqueios, bestiário e a **jornada em andamento**, salva a cada rodada (fechar ou recarregar a página não perde nada). Dados ausentes, corrompidos ou de versões antigas são validados e substituídos por padrões seguros; em navegadores que bloqueiam o armazenamento o jogo funciona normalmente, só sem persistência.

## Testes

Requer Node 18+. O teste ponta a ponta usa Playwright com Chromium.

```bash
npm test             # regras do motor + fuzz com bot aleatório + jornadas com bot tático
npm run test:balance # estatísticas de equilíbrio (taxa de vitória, rodadas por terreiro, causas de derrota)
npm run test:e2e     # joga uma jornada inteira pela interface, recarrega a página no meio e confere o salvamento
```

- `tests/rules.js` — 32 situações montadas à mão (empurrões, afogamento, fogo amigo, dádivas, chefe, ondas, geração de mapas, salvamento).
- `tests/sim.js` — joga centenas de jornadas com bots, verifica invariantes a cada passo (sobreposição, casas inválidas, serialização) e o determinismo por semente.
- `tests/e2e.js` — navegador real em desktop e celular: jornada completa até a vitória, recarregar no meio da rodada, salvamento corrompido, menus e Desafio do Dia, sem erros de console.

## Estrutura

```
index.html        telas e interface
css/style.css     visual e layout responsivo
js/util.js        RNG determinístico e utilidades
js/data.js        heróis, criaturas, dádivas, terreiros, provações e marcas
js/engine.js      regras puras (estado em JSON, sem DOM)
js/sprites.js     pixel art definida em texto, com contorno automático
js/render.js      canvas: terreno, marcas de ataque, animações, partículas e luz
js/audio.js       efeitos e trilha generativa (atabaques e agogô) via WebAudio
js/save.js        salvamento, validação, recordes, marcas e Desafio do Dia
js/main.js        fluxo das telas, entrada e ritmo das rodadas
tests/            regras, simulação com bots e teste no navegador
```

Sem dependências, sem build e sem servidor: é HTML, CSS e JavaScript puros.

## Sobre o tema

Axé é uma homenagem à cosmologia iorubá e à Umbanda. Os heróis são filhos de santo que carregam o axé de seus orixás; os inimigos são os **Ajogun** — na tradição iorubá, as forças adversas que trazem perda, doença, maldição, paralisia, encrenca e morte — e os **kiumbas**, espíritos obsessores da Umbanda. Exu aparece como o guardião que abre os caminhos da encruzilhada, nunca como vilão. O jogo não reproduz ritos e não pretende falar por nenhuma casa ou tradição.
