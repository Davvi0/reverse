# REVERSE — Etapa 3: modo competitivo

## Instalação

1. No Supabase SQL Editor, execute `supabase/ETAPA-3-COMPETITIVO.sql` **uma única vez**, depois de `schema.sql` e `ETAPA-2-ONLINE.sql`.
2. Mantenha seu `.env` com `VITE_SUPABASE_URL` e `VITE_SUPABASE_ANON_KEY`. Nunca coloque `service_role` no frontend.
3. `npm install` e `npm run dev`.
4. Abra dois navegadores (normal + anônimo), crie uma sala **nova** e entre pelo código.
5. Inicie a sala e clique em **INICIAR COMPETIÇÃO** na tela do anfitrião.

## Regras

- Uma partida tem uma rodada por participante; o criador alterna a cada rodada.
- Criador grava a frase original; os outros enviam suas tentativas em paralelo.
- Com 3+ jogadores, todos votam, sem votar em si próprios: +100 por voto, +150 para cada tentativa empatada em primeiro, +50 para o criador.
- Com 2 jogadores, a rodada é revelada automaticamente e atribui +150 ao participante que tentou e +50 ao criador. Não há votação artificial.
- O anfitrião avança a revelação e inicia uma revanche. O modo local permanece intacto.

## Limitações conhecidas

- O jogo depende de microfone e de Supabase Storage com bucket privado `reverse-audio` criado na etapa 2.
- Em revanche, os arquivos antigos continuam no Storage; planeje limpeza por expiração para produção.
- Os votos e pontos são validados no banco. Para uma versão pública, recomenda-se revisar a política de acesso a metadados e áudios, pois participantes técnicos podem inspecionar dados da sala.
- Não foi possível executar teste de ponta a ponta conectado ao seu projeto Supabase nem concluir a instalação de dependências neste ambiente.
