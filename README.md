# Lunerb (nome provisório)

**Um jogo de Felipe Gandini e Lucas Gandini.**

Jogo de aventura sombria em 3D (vista axonométrica, blocos), feito para o navegador do celular, tela deitada.
Pode ser instalado na tela inicial ("Adicionar à tela inicial") e funciona sem internet depois da primeira vez.

- Link para jogar: https://luigandini.github.io/lunerbexplorer/
- História completa: prólogo + 8 fases em 4 mundos. Esta versão (v4) tem o **Prólogo**, o **Mundo 1: Fortaleza de Cinzarocha** (fases 1–2) e o **Mundo 2: Bosque dos Sussurros** (fases 3–4, com o Feligon).
- Estilo: 3D estilizado em salas-maquete flutuantes (cada sala aparece inteira na tela).
- Versões anteriores guardadas: …/versao-01/ (blocos), …/versao-02/ (maquete), …/versao-03/ (armas novas), …/versao-04/ (antes da troca de herói)
- Celular muito simples travando? Abra com `?baixa` no fim do link (modo leve, sem sombras). O jogo também liga esse modo sozinho se perceber que está lento.

## Controles
- Lado esquerdo da tela: arraste para andar
- Botão vermelho **ATACAR**: soco/chute de perto, bola de fogo de longe. Com as duas Booteshiscore, segure e solte para o **laser**.
- Botão roxo **TURBO**: Turbo Negro (corrida que atravessa monstros). Enche derrotando monstros.
- No computador: WASD/setas para andar, J ataca, K turbo.

## Armas (v3)
- Cada herói tem sua **arma própria** fora da mochila (Lunerb: Booteshiscore; Feligon: estilingue de sementes).
- **Mochila do time**: 2 espaços + 1 por amigo resgatado; todos usam tudo. Toque no quadradinho para escolher.
- **Bombas** e **Super Bomba**: segure ATACAR para a mira correr no chão, solte para jogar. Perto demais machuca o Lunerb.
- **Arma de Choque**: raio que persegue o monstro (alcance curto). **Turbina de Laser**: toque liga, toque desliga; trava o Lunerb e atira reto.
- Diamantes compram armas com o **Mercador Misterioso**, que aparece de surpresa em algumas salas.
- Desmaiou? A fase recomeça da primeira sala (diamantes e armas ficam). Fogueira azul recupera a vida. Dá para voltar para a sala anterior pelo portal laranja.

## Amigos e troca de herói (Mundo 2)
- Toque no **rostinho** no canto direito (ou 3 toques rápidos no botão verde) para jogar com o outro herói.
- Cada herói tem seus corações. Se o que você controla desmaiar, o outro assume na hora; o desmaiado acorda na sala seguinte. A fase só recomeça se os dois desmaiarem.
- Jogando com o Feligon, o botão verde manda o Lunerb lançar o **Raio Negro**. **Portões de raízes** só o Feligon abre.

- O **Feligon** (personagem do Felipe) é resgatado do casulo da Mãe-Teia e luta junto.
- Botão verde **AMIGO**: segure, mire com o direcional e solte → ele lança **Raízes** (prende os monstros e dá 1 coração). Recarrega em 9 s.

## Modo teste (para o Luis)
Toque **7 vezes seguidas no título LUNERB** na tela inicial. Aparece "MODO TESTE":
todas as fases liberadas, +100 cristais na Forja, e no menu de pausa: invencível e pular fase.
Toque 7 vezes de novo para desligar.

## Organização do código
- `src/levels.js` – salas e dados das fases (separados do código)
- `src/progress.js` – estrelas, liberação de fases, Forja
- `src/save.js` – progresso salvo no próprio aparelho
- `src/game.js` – jogo (Lunerb, monstros, chefão)
- `src/world.js`, `src/props.js`, `src/textures.js` – maquetes, árvores/pedras/tochas, texturas desenhadas pelo jogo
- `src/models.js`, `src/geo.js` – personagens no estilo novo (Lunerb, Lucas, Feligon, Dait, monstros)
- `src/legacy/models-voxel.js` – backup dos personagens em blocos
- `src/audio.js` – música 8-bit e sons gerados pelo jogo
- `vendor/three.module.min.js` – Three.js (licença MIT)

## Testes (rodar antes de cada publicação)
```
npm test          # testes automáticos das fases, save, Forja e arquivos
npm run smoke     # abre o jogo num Chrome de verdade, joga um pouco e tira fotos (precisa de npm i)
node tools/smoke-armas.mjs   # testa bombas, choque, turbina, loja, voltar de sala e morte
node tools/smoke-mundo2.mjs  # testa o Mundo 2, a Mãe-Teia, o Feligon e o Ancião Oco
node tools/smoke-mundo3.mjs  # testa pontes, névoa, gás, Sapo-Lodo Rei, resgate do Dait e Hidra
node tools/smoke-mundo4.mjs  # testa a torre, Golem, Morgrave nas 3 etapas, golpe final e a cena final
node tools/smoke-desmaio.mjs  # testa desmaios em todas as situações, mapa e destravamento
node tools/robo.mjs 40       # robô que joga todas as fases apertando botões ao acaso (40 s por fase)
```
