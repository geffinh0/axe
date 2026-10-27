# Axé

Roguelite tático por turnos, curto e rejogável, inspirado na **Umbanda** e na **cosmologia iorubá**. Os filhos de santo contra os Ajogun.

Os Ajogun, as forças da desordem, romperam o caminho entre o Orun e o Aiyê, e Ikú, a Morte, vem buscar a aldeia antes da hora. Você é um filho de santo que carrega o axé do seu orixá e precisa fechar **seis terreiros** até enfrentar Ikú. Uma jornada dura de 10 a 15 minutos.

Jogue em https://geffinh0.github.io/axe/

## Como jogar

Abra o `index.html` em qualquer navegador moderno. Não precisa de servidor, instalação nem internet. Para servir na rede local: `python3 -m http.server 8080` e acesse `http://localhost:8080`.

No teclado:

| Ação | Tecla |
| --- | --- |
| Andar e golpear | setas ou WASD |
| Habilidade | Espaço ou Q para mirar, de novo para usar |
| Esperar uma rodada | E |
| Cancelar ou pausar | Esc |
| Som | M |

No toque:

| Ação | Gesto |
| --- | --- |
| Andar e golpear | tocar numa casa vizinha, ou deslizar o dedo na direção |
| Ver o que há numa casa | segurar o dedo sobre ela |
| Habilidade | tocar no botão, depois na casa ou direção, e tocar de novo para confirmar |
| Esperar uma rodada | botão Esperar |

Com o celular deitado, o tabuleiro ocupa a altura da tela, com vida e botões à esquerda e os avisos à direita.

### O ciclo de uma jornada

1. **Escolha** um filho de santo (e, depois da primeira vitória, provações que multiplicam a pontuação).
2. **Terreiro**: você age, depois todos os inimigos agem. Todo ataque inimigo é **anunciado uma rodada antes** com casas vermelhas. Saia delas ou derrote quem vai atacar.
3. **Fogo amigo**: ataques dos Ajogun ferem qualquer um nas casas marcadas, inclusive outros Ajogun. Empurrões contra pedras, criaturas e o rio também ferem. Boa parte da graça é fazer os inimigos se destruírem.
4. **Ondas**: cada terreiro tem 2 ou 3 ondas, anunciadas por marcas roxas no chão. A próxima chega quando a atual cai ou quando o tempo acaba.
5. **Encruzilhada**: entre terreiros, Exu abre os caminhos e você escolhe uma de três **dádivas** ou um Banho de Ervas (+2 de vida).
6. **Ikú**: no sexto terreiro, a Morte atravessa o campo em linhas, lança sentenças e chama kiumbas. Depois de cada travessia fica atordoada e o próximo golpe dobra.
7. **Resultado**: pontuação detalhada, nota (S a D), uma lição sobre o que derrotou você, recordes, marcas conquistadas e "Tentar de novo".

## Conteúdo

- **4 filhos de santo**, cada um com passiva e habilidade próprias:
  - **Kayode, filho de Ogum**: golpe que empurra; *Abre-Caminho* (investida que arremessa).
  - **Ayo, filha de Oxóssi**: golpe que atravessa; *Flecha Certeira* (tiro de longo alcance).
  - **Tunde, filho de Xangô**: golpe que incendeia e imunidade ao fogo; *Pedra de Raio* (área em cruz que deixa o chão em chamas).
  - **Folake, filha de Iansã**: raio que salta entre inimigos; *Ventania* (empurra tudo ao redor). Liberada ao vencer a jornada uma vez.
- **9 criaturas** com comportamentos distintos: Kiumba, Zombeteiro e Obsessor (kiumbas da Umbanda) e os Ajogun Òfò (perda), Òràn (encrenca), Àrùn (doença), Èpè (maldição), Ègbà (paralisia) e Ikú (a morte).
- **4 biomas**: Mata Sagrada, Beira do Rio, Pedreira de Xangô e Calunga, cada um com obstáculos, perigos e trilha sonora próprios.
- **16 dádivas** que se combinam (por exemplo Pedreira com o rio, Ligeireza de Oyá com Fio de Ogum, Rastro de Pólvora com imunidade ao fogo).

## Por que jogar de novo

- **Terreiros gerados por semente**: mapas, ondas e ofertas de dádivas mudam a cada jornada.
- **Recordes e notas** por herói, com pontuação que recompensa rapidez, terreiros sem dano e truques (fogo amigo, rio, batidas).
- **Provações** (liberadas após a primeira vitória): Horda dos Ajogun, Corpo Frágil, Chuva de Brasa e Couro Grosso. Combináveis, cada uma muda a estratégia e multiplica o axé.
- **Desafio do Dia**: mesma semente, herói e provação para todo mundo naquele dia.
- **11 marcas** (objetivos secundários), **bestiário** que se preenche ao encontrar criaturas e **histórico** das últimas jornadas.
- **Semente escolhida** (na escolha de herói) para repetir ou compartilhar um caminho.

## Salvamento

Tudo fica no `localStorage` do navegador: configurações, recordes, marcas, desbloqueios, bestiário e a **jornada em andamento**, salva a cada rodada (fechar ou recarregar a página não perde nada). Dados ausentes, corrompidos ou de versões antigas são validados e substituídos por padrões seguros; em navegadores que bloqueiam o armazenamento o jogo funciona normalmente, só sem guardar o progresso.

## A página inicial

A página em volta do jogo mostra o próprio jogo: o tabuleiro à direita (ou logo abaixo do botão Jogar, no celular) é um terreiro de verdade, jogado ao vivo pelo jogador automático com as mesmas regras e marcas do jogo, e muda de terreiro conforme a leitura avança. Em "Quatro caminhos" você escolhe um filho de santo e o vê lutar. As duas imagens fixas (`assets/`) também saem do motor e do renderizador do jogo, geradas por `node tests/capture.js`.

Fontes: Pixelify Sans, de Stefie Justprince, nos títulos e botões (a mesma linguagem de pixel do jogo), e Jost, de Owen Earl, no texto; as duas sob a licença SIL Open Font License 1.1, embutidas em `css/fonts.css` para funcionar também abrindo o arquivo direto do disco.

## Testes

Requer Node 18+. O teste ponta a ponta usa Playwright com Chromium.

```bash
npm test             # regras do motor, fuzz com bot aleatório e jornadas com bot tático
npm run test:balance # estatísticas de equilíbrio (taxa de vitória, rodadas por terreiro, causas de derrota)
npm run test:e2e     # joga uma jornada inteira pela interface e testa toque, celular e salvamento
```

- `tests/rules.js`: 32 situações montadas à mão (empurrões, afogamento, fogo amigo, dádivas, chefe, ondas, geração de mapas, salvamento).
- `tests/sim.js`: joga centenas de jornadas com bots, verifica invariantes a cada passo (sobreposição, casas inválidas, serialização) e o determinismo por semente.
- `tests/e2e.js`: navegador real no computador e no celular. Jornada completa até a vitória, recarregar no meio da rodada, salvamento corrompido, menus, Desafio do Dia, página inicial ao vivo, tocar, deslizar e segurar o dedo no tabuleiro, celular deitado e nenhum erro de console.

## Estrutura

```
index.html        página inicial, telas e interface
css/fonts.css     Pixelify Sans e Jost embutidas (OFL)
css/style.css     visual (as cores do terreiro à noite) e layout para computador e celular
js/util.js        RNG determinístico e utilidades
js/data.js        heróis, criaturas, dádivas, terreiros, provações, marcas e dicas
js/engine.js      regras puras (estado em JSON, sem DOM)
js/sprites.js     pixel art definida em texto, com contorno automático
js/render.js      canvas: terreno, marcas de ataque, setas de movimento, animações e luz
js/bot.js         jogador automático (usado na página inicial e nos testes)
js/demo.js        terreiro ao vivo da página inicial
js/audio.js       efeitos e trilha generativa (atabaques e agogô) via WebAudio
js/save.js        salvamento, validação, recordes, marcas e Desafio do Dia
js/main.js        fluxo das telas, teclado, toque e ritmo das rodadas
assets/           capturas do jogo usadas na página inicial
tests/            regras, simulação com bots, teste no navegador e geração das capturas
```

Sem dependências, sem build e sem servidor: é HTML, CSS e JavaScript puros.

## Sobre o tema

Axé é uma homenagem à cosmologia iorubá e à Umbanda. Os heróis são filhos de santo que carregam o axé de seus orixás. Os inimigos são os **Ajogun**, que na tradição iorubá trazem perda, doença, maldição, paralisia, encrenca e morte, e os **kiumbas**, espíritos obsessores da Umbanda. Exu aparece como o guardião que abre os caminhos da encruzilhada, nunca como vilão. O jogo não reproduz ritos e não pretende falar por nenhuma casa ou tradição.
