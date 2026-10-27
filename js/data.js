/* Conteúdo do jogo: heróis, Ajogun e kiumbas, dádivas, terreiros (fases), provações e marcas. */
(function (root) {
  'use strict';
  const FF = (root.FF = root.FF || {});

  const HEROES = {
    ogum: {
      id: 'ogum',
      name: 'Kayode',
      orixa: 'Ogum',
      title: 'Filho de Ogum',
      saudacao: 'Ogunhê!',
      hp: 6,
      difficulty: 1,
      flags: { knock: true },
      passive: 'Ferro de Ogum: seu golpe empurra o inimigo 1 casa. Batidas em paredes ou em outras criaturas causam 1 de dano.',
      ability: {
        id: 'abrecaminho',
        name: 'Abre-Caminho',
        cd: 3,
        target: 'dir',
        desc: 'Avança até 3 casas em linha reta. A primeira criatura no caminho sofre 1 de dano e é arremessada 2 casas.',
      },
      blurb: 'O ferreiro dos caminhos. Resistente, controla o campo empurrando inimigos contra pedras, rios e uns contra os outros.',
      unlock: null,
    },
    oxossi: {
      id: 'oxossi',
      name: 'Ayo',
      orixa: 'Oxóssi',
      title: 'Filha de Oxóssi',
      saudacao: 'Okê Arô!',
      hp: 5,
      difficulty: 1,
      flags: { pierce: true },
      passive: 'Ofá: seu golpe atravessa e atinge também quem estiver logo atrás do alvo.',
      ability: {
        id: 'flecha',
        name: 'Flecha Certeira',
        cd: 3,
        target: 'dir',
        desc: 'Dispara a flecha única de Oxóssi em linha reta (até 7 casas). Causa 2 de dano à primeira criatura atingida.',
      },
      blurb: 'A caçadora de uma flecha só. Abate inimigos à distância antes que eles se aproximem.',
      unlock: null,
    },
    xango: {
      id: 'xango',
      name: 'Tunde',
      orixa: 'Xangô',
      title: 'Filho de Xangô',
      saudacao: 'Kaô Kabecilê!',
      hp: 4,
      difficulty: 2,
      flags: { burnHit: true, fireproof: true },
      passive: 'Fogo da Justiça: seu golpe incendeia o alvo (mais 1 de dano no fim da rodada). Você é imune ao fogo.',
      ability: {
        id: 'pedraderaio',
        name: 'Pedra de Raio',
        cd: 5,
        target: 'tile',
        range: 3,
        desc: 'Lança uma pedra de raio a até 3 casas: 1 de dano em cruz e o chão arde em fogo por 2 rodadas.',
      },
      blurb: 'O senhor do trovão. Frágil, mas transforma o terreiro em fogo — e fica de pé no meio dele.',
      unlock: null,
    },
    iansa: {
      id: 'iansa',
      name: 'Folake',
      orixa: 'Iansã',
      title: 'Filha de Iansã',
      saudacao: 'Eparrei, Oyá!',
      hp: 5,
      difficulty: 3,
      flags: { chain: true },
      passive: 'Relâmpago: quando seu golpe derrota alguém, um raio salta e causa 1 de dano ao inimigo mais próximo (até 3 casas).',
      ability: {
        id: 'ventania',
        name: 'Ventania',
        cd: 3,
        target: 'none',
        desc: 'Um redemoinho empurra 2 casas todas as criaturas ao seu redor (8 casas vizinhas).',
      },
      blurb: 'A senhora dos ventos e guia dos eguns. Espalha os inimigos e encadeia raios — exige leitura de campo.',
      unlock: 'Vença a jornada uma vez para que Iansã responda ao seu chamado.',
    },
  };

  const HERO_ORDER = ['ogum', 'oxossi', 'xango', 'iansa'];

  // ai: comportamento base. move: casas por rodada. dmg: dano do ataque preparado.
  const ENEMIES = {
    kiumba: {
      name: 'Kiumba',
      kind: 'Espírito obsessor',
      hp: 1,
      ai: 'melee',
      move: 1,
      dmg: 1,
      score: 10,
      desc: 'Espírito zombeteiro de baixa vibração. Anda até você e prepara um golpe na casa vizinha.',
      tip: 'Um golpe basta. O perigo é deixar vários chegarem juntos.',
    },
    ofo: {
      name: 'Òfò',
      kind: 'Ajogun da Perda',
      hp: 1,
      ai: 'line',
      move: 1,
      dmg: 1,
      range: 6,
      score: 15,
      desc: 'Atira em linha reta e acerta a primeira criatura no caminho — inclusive outros Ajogun.',
      tip: 'Saia da linha ou se esconda atrás de árvores e pedras. Melhor ainda: deixe outro inimigo no meio do tiro.',
    },
    zombeteiro: {
      name: 'Zombeteiro',
      kind: 'Kiumba saltador',
      hp: 2,
      ai: 'spin',
      move: 2,
      dmg: 1,
      score: 20,
      desc: 'Salta até 2 casas por cima de obstáculos e rodopia, acertando as 4 casas ao redor dele.',
      tip: 'O rodopio acerta em cruz. Afaste-se em linha reta ou fique na diagonal.',
    },
    obsessor: {
      name: 'Obsessor',
      kind: 'Kiumba caçador',
      hp: 2,
      ai: 'melee',
      move: 2,
      dmg: 1,
      score: 25,
      desc: 'Persegue sem descanso: anda 2 casas por rodada e prepara o golpe assim que chega.',
      tip: 'Não dá para fugir dele. Use árvores e o rio para obrigá-lo a dar a volta.',
    },
    oran: {
      name: 'Òràn',
      kind: 'Ajogun da Encrenca',
      hp: 3,
      ai: 'charge',
      move: 1,
      dmg: 2,
      range: 8,
      trail: true,
      fireproof: true,
      score: 30,
      desc: 'Quando se alinha com você, dispara em investida: atropela a primeira criatura no caminho (2 de dano) e deixa um rastro de brasas.',
      tip: 'Saia da faixa marcada. Se houver outro inimigo na frente, é ele quem será atropelado.',
    },
    arun: {
      name: 'Àrùn',
      kind: 'Ajogun da Doença',
      hp: 3,
      ai: 'summon',
      move: 0,
      dmg: 0,
      score: 25,
      desc: 'Não se move. A cada poucas rodadas, faz brotar um Kiumba numa casa vizinha marcada.',
      tip: 'Fique em cima da casa marcada para impedir o nascimento — ou elimine Àrùn cedo.',
    },
    epe: {
      name: 'Èpè',
      kind: 'Ajogun da Maldição',
      hp: 2,
      ai: 'aoe',
      move: 1,
      dmg: 1,
      range: 5,
      score: 30,
      desc: 'Mantém distância e arremessa uma maldição em X sobre você. O chão atingido arde por 1 rodada.',
      tip: 'A maldição cai em X onde você estava quando ela mirou: qualquer passo reto escapa.',
    },
    egba: {
      name: 'Ègbà',
      kind: 'Ajogun da Paralisia',
      hp: 6,
      ai: 'melee',
      move: 1,
      sweep: true,
      stuck: 2,
      heavy: true,
      dmg: 2,
      score: 80,
      elite: true,
      desc: 'Gigante que não pode ser empurrado. Seu golpe pesado varre as 3 casas à frente dele (2 de dano) e depois ele fica preso por 2 rodadas.',
      tip: 'Para escapar do golpe, recue — de lado ainda acerta. Depois que ele golpear, avance e bata enquanto está preso.',
    },
    iku: {
      name: 'Ikú',
      kind: 'A Morte',
      hp: 28,
      ai: 'boss',
      move: 1,
      heavy: true,
      fireproof: true,
      dmg: 2,
      score: 400,
      boss: true,
      desc: 'Veio buscar a aldeia antes da hora. Atravessa o terreiro em linha reta, lança sentenças em X e chama kiumbas. Fica mais rápida conforme se fere.',
      tip: 'Depois de cada travessia, Ikú fica atordoada por duas rodadas e o próximo golpe que sofrer causa dano dobrado.',
    },
  };

  const BIOMES = {
    mata: { name: 'Mata Sagrada', wall: 'arvore', water: 0, walls: [9, 13], thorns: [0, 2], fires: 0 },
    rio: { name: 'Beira do Rio', wall: 'pedra', water: [7, 11], walls: [4, 6], thorns: [0, 2], fires: 0 },
    pedreira: { name: 'Pedreira de Xangô', wall: 'rocha', water: 0, walls: [8, 11], thorns: [4, 6], fires: 2 },
    calunga: { name: 'Calunga', wall: 'lapide', water: 0, walls: [6, 8], thorns: [2, 3], fires: 0 },
  };

  // Cada terreiro tem modelos de ondas; um é sorteado pela semente.
  const STAGES = [
    {
      name: 'Entrada da Mata',
      biome: 'mata',
      timer: 11,
      templates: [
        [['kiumba', 'kiumba'], ['kiumba', 'kiumba', 'kiumba']],
        [['kiumba', 'kiumba'], ['kiumba', 'kiumba', 'ofo']],
      ],
    },
    {
      name: 'Clareira de Oxóssi',
      biome: 'mata',
      timer: 10,
      templates: [
        [['kiumba', 'kiumba', 'ofo'], ['zombeteiro', 'kiumba', 'ofo']],
        [['zombeteiro', 'kiumba'], ['ofo', 'ofo', 'kiumba', 'kiumba']],
        [['kiumba', 'ofo', 'kiumba'], ['zombeteiro', 'zombeteiro']],
      ],
    },
    {
      name: 'Remanso de Oxum',
      biome: 'rio',
      timer: 9,
      templates: [
        [['obsessor', 'kiumba', 'kiumba'], ['oran', 'ofo', 'kiumba'], ['zombeteiro', 'kiumba', 'kiumba']],
        [['oran', 'kiumba', 'kiumba'], ['obsessor', 'ofo', 'zombeteiro'], ['kiumba', 'kiumba', 'ofo']],
        [['obsessor', 'ofo', 'kiumba'], ['oran', 'kiumba', 'kiumba'], ['obsessor', 'zombeteiro']],
      ],
    },
    {
      name: 'Cachoeira',
      biome: 'rio',
      timer: 9,
      templates: [
        [['arun', 'ofo', 'kiumba', 'kiumba'], ['egba', 'zombeteiro', 'kiumba'], ['obsessor', 'ofo', 'kiumba', 'kiumba']],
        [['arun', 'obsessor', 'kiumba', 'kiumba'], ['egba', 'ofo', 'kiumba'], ['oran', 'zombeteiro', 'kiumba', 'kiumba']],
      ],
    },
    {
      name: 'Pedreira de Xangô',
      biome: 'pedreira',
      timer: 8,
      templates: [
        [['epe', 'obsessor', 'kiumba', 'kiumba', 'kiumba'], ['oran', 'epe', 'zombeteiro', 'ofo', 'kiumba'], ['arun', 'obsessor', 'obsessor', 'kiumba', 'kiumba']],
        [['epe', 'oran', 'kiumba', 'ofo', 'kiumba'], ['arun', 'obsessor', 'epe', 'kiumba', 'kiumba'], ['zombeteiro', 'zombeteiro', 'oran', 'ofo']],
        [['obsessor', 'obsessor', 'epe', 'kiumba', 'kiumba'], ['oran', 'zombeteiro', 'ofo', 'epe'], ['egba', 'ofo', 'kiumba', 'kiumba']],
      ],
    },
    {
      name: 'Portão de Ikú',
      biome: 'calunga',
      boss: true,
      templates: [[['iku']]],
    },
  ];

  // stack: quantas vezes pode ser escolhida. excl: heróis que já têm o efeito.
  const BOONS = {
    ori: { name: 'Força do Orí', icon: 'heart', stack: 3, desc: '+1 de vida máxima e cura 2.' },
    ferro: { name: 'Fio de Ogum', icon: 'blade', stack: 2, desc: 'Seus golpes causam +1 de dano.' },
    ponta: { name: 'Ponta de Lança', icon: 'spear', stack: 1, excl: ['oxossi'], desc: 'Seu golpe atinge também quem estiver logo atrás do alvo.' },
    oxe: { name: 'Oxê de Xangô', icon: 'axe', stack: 1, desc: 'Seu golpe atinge também as duas casas ao lado do alvo.' },
    oya: { name: 'Ligeireza de Oyá', icon: 'wind', stack: 1, desc: 'Derrotar alguém com um golpe devolve sua ação (uma vez por rodada).' },
    guia: { name: 'Guia de Proteção', icon: 'beads', stack: 1, desc: 'Bloqueia o primeiro dano que você sofreria em cada terreiro.' },
    abebe: { name: 'Abebé de Oxum', icon: 'mirror', stack: 1, desc: 'Quem ferir você sofre 1 de dano de volta.' },
    brasa: { name: 'Brasa de Xangô', icon: 'flame', stack: 1, excl: ['xango'], desc: 'Seu golpe incendeia o alvo (mais 1 de dano no fim da rodada).' },
    vento: { name: 'Sopro de Iansã', icon: 'swirl', stack: 2, desc: 'Sua habilidade recarrega 1 rodada mais rápido.' },
    ponto: { name: 'Ponto Riscado', icon: 'star', stack: 2, desc: 'Sua habilidade fica mais forte (+1 de dano ou de alcance).' },
    defumacao: { name: 'Defumação', icon: 'smoke', stack: 1, desc: 'A cada 4 inimigos derrotados, você cura 1 de vida.' },
    polvora: { name: 'Rastro de Pólvora', icon: 'trail', stack: 1, desc: 'Ao andar, você deixa brasas por 2 rodadas na casa de onde saiu. Você fica imune ao fogo.' },
    pedreira: { name: 'Pedreira', icon: 'fist', stack: 1, excl: ['ogum'], desc: 'Seu golpe empurra o alvo 1 casa. Batidas causam 1 de dano.' },
    ginga: { name: 'Ginga', icon: 'dodge', stack: 1, desc: 'Inimigo que errar o ataque preparado contra você fica tonto e perde a próxima rodada.' },
    patua: { name: 'Patuá', icon: 'armor', stack: 1, desc: 'Ataques de 2 ou mais de dano causam 1 a menos em você.' },
    ancestrais: { name: 'Força dos Ancestrais', icon: 'mask', stack: 1, desc: 'Com 2 de vida ou menos, seus golpes causam +1 de dano.' },
  };

  const PROVACOES = {
    horda: { name: 'Horda dos Ajogun', mult: 0.35, desc: 'Cada onda traz uma criatura a mais (Obsessores a partir do 3º terreiro) e as ondas chegam mais rápido.' },
    fragil: { name: 'Corpo Frágil', mult: 0.3, desc: '1 de vida máxima a menos e sem cura automática entre terreiros.' },
    chuva: { name: 'Chuva de Brasa', mult: 0.25, desc: 'A cada 3 rodadas, brasas caem do céu sobre 4 casas marcadas perto de você.' },
    couro: { name: 'Couro Grosso', mult: 0.35, desc: 'Todos os inimigos comuns têm +1 de vida.' },
  };
  const PROVA_ORDER = ['horda', 'fragil', 'chuva', 'couro'];

  const MARKS = {
    primeiro: { name: 'Primeiro Passo', desc: 'Feche o primeiro terreiro.' },
    corpofechado: { name: 'Corpo Fechado', desc: 'Feche um terreiro a partir do terceiro sem sofrer dano.' },
    discordia: { name: 'Discórdia', desc: 'Faça os inimigos derrotarem 3 dos seus em uma mesma jornada.' },
    correnteza: { name: 'Levados pela Correnteza', desc: 'Jogue 3 inimigos no rio em uma mesma jornada.' },
    iku: { name: 'Vitória sobre Ikú', desc: 'Vença a jornada.' },
    porumfio: { name: 'Por um Fio', desc: 'Vença com apenas 1 de vida.' },
    ligeiro: { name: 'Pés Ligeiros', desc: 'Vença em menos de 110 rodadas.' },
    provado: { name: 'Provado no Fogo', desc: 'Vença com 2 ou mais provações ativas.' },
    todos: { name: 'Todos os Caminhos', desc: 'Vença com os quatro filhos de santo.' },
    lenda: { name: 'Lenda do Terreiro', desc: 'Termine uma jornada com nota S.' },
    diario: { name: 'Caminho do Dia', desc: 'Vença um Desafio do Dia.' },
  };

  const RANKS = [
    { r: 'S', min: 6500 },
    { r: 'A', min: 5300 },
    { r: 'B', min: 3800 },
    { r: 'C', min: 2200 },
    { r: 'D', min: 0 },
  ];

  const TIPS = {
    start: 'Objetivo: derrote todas as ondas para fechar o terreiro. Setas/WASD (ou toque nas casas vizinhas) movem; andar contra um inimigo é golpeá-lo.',
    telegraph: 'Casas marcadas em vermelho serão atacadas na próxima rodada. Saia delas — ou derrote quem vai atacar antes.',
    ability: 'Sua habilidade está pronta: aperte ESPAÇO ou o botão de habilidade.',
    wave: 'Marcas no chão indicam onde a próxima onda vai surgir.',
    friendly: 'Ataques dos inimigos também ferem outros inimigos. Use isso a seu favor!',
    lowhp: 'Vida baixa. Na encruzilhada você pode escolher um Banho de Ervas para se curar.',
    wait: 'Às vezes esperar (tecla E ou botão Esperar) é a melhor jogada: deixe que eles venham até você.',
  };

  // Lições mostradas na derrota, de acordo com quem derrotou você.
  const DEATH_LESSONS = {
    kiumba: 'Lute em passagens estreitas entre árvores e pedras: assim só um Kiumba alcança você por vez.',
    ofo: 'O tiro de Òfò para na primeira coisa que encontra. Coloque obstáculos ou outros inimigos entre vocês.',
    zombeteiro: 'O rodopio do Zombeteiro só acerta em cruz. A diagonal é sempre segura.',
    obsessor: 'O Obsessor anda 2 casas: não fuja dele em campo aberto. Espere atrás de um obstáculo e golpeie quando ele chegar.',
    oran: 'A investida de Òràn segue a faixa marcada. Saia dela — ou deixe outro inimigo ser atropelado.',
    arun: 'Àrùn não para de chamar kiumbas. Derrube-o cedo ou bloqueie a casa onde eles nascem.',
    epe: 'A maldição de Èpè cai em X onde você estava. Qualquer passo reto escapa — só não pise no fogo.',
    egba: 'O golpe de Ègbà varre 3 casas: só recuar escapa. Nunca lute com ele de costas para uma parede.',
    iku: 'Depois de cada travessia, Ikú fica atordoada e o próximo golpe dobra. Esquive para o lado e corra para ela.',
    fogo: 'Brasas ferem quem termina a rodada em cima delas. Fique de olho no chão.',
    espinhos: 'Espinhos ferem quem pisa neles. Prefira dar a volta.',
    default: 'Leia as marcas vermelhas antes de cada passo.',
  };

  FF.data = {
    HEROES,
    HERO_ORDER,
    ENEMIES,
    BIOMES,
    STAGES,
    BOONS,
    PROVACOES,
    PROVA_ORDER,
    MARKS,
    RANKS,
    TIPS,
    DEATH_LESSONS,
    W: 9,
    H: 9,
    WAVE_TIMER: 9,
  };
})(typeof window !== 'undefined' ? window : globalThis);
