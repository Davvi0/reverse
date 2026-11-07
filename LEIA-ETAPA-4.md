REVERSE — ETAPA 4: VISUAL, VOTOS E RODADAS

1. Antes de atualizar, faça cópia da sua pasta e .env.
2. Rode no Supabase SQL Editor, NA ORDEM:
   - schema.sql (caso ainda não tenha rodado)
   - ETAPA-2-ONLINE.sql (caso ainda não tenha rodado)
   - ETAPA-3-COMPETITIVO-CORRIGIDO.sql (caso ainda não tenha rodado)
   - ETAPA-4-VOTOS-RODADAS.sql (OBRIGATÓRIO para esta versão)
   - ETAPA-5-AVALIACAO-INVERTIDA.sql (OBRIGATÓRIO para avaliação invertida em partidas com duas pessoas)
3. Coloque seu .env na pasta reverse-online.
4. Execute: npm install && npm run dev
5. Teste em uma sala NOVA; partidas antigas iniciadas antes da etapa 4 não são migradas.

MUDANÇAS
- Tela competitiva redesenhada com classes CSS próprias.
- Online: 3, 5 ou 8 rodadas, selecionadas pelo anfitrião ao iniciar.
- 3 ou mais jogadores: votos confirmados por todos; pontuação só após o último voto.
- 2 jogadores: o criador compara a tentativa do oponente com a frase original e dá de 0 a 300 pontos.
- Local: escolha 3, 5 ou 8 rodadas antes de iniciar; alterna quem cria frase.
- Revanche online sem repetir caminhos de arquivos de áudio.

IMPORTANTE
A pontuação online depende do SQL atualizado. Execute as etapas 4 e 5; sem a etapa 5, o Supabase bloqueia o áudio invertido e a avaliação em partidas com duas pessoas.
As verificações automáticas aqui checaram a sintaxe dos arquivos JS/JSX; não substituem teste com Supabase e microfones reais.
