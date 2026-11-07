REVERSE — ETAPA 2: MULTIPLAYER COM ÁUDIOS

1. O schema.sql da primeira etapa já deve ter sido executado.
2. Supabase > SQL Editor > New Query: cole e execute TODO o arquivo supabase/ETAPA-2-ONLINE.sql.
3. Mantenha seu .env existente com VITE_SUPABASE_URL e VITE_SUPABASE_ANON_KEY (não inclua service_role).
4. Na pasta reverse-online, execute npm install e npm run dev.
5. Abra em dois navegadores (normal e anônimo), crie uma NOVA sala, entre com o código e inicie.
6. O primeiro jogador grava a frase. Quando enviar, a vez muda automaticamente; o próximo escuta a frase invertida e grava sua tentativa.
7. Após todos gravarem, o anfitrião avança a revelação; todos podem ouvir. No fim, pode reiniciar a partida.

OBSERVAÇÕES
- A frase invertida apresentada a cada jogador é a frase original invertida, como no modo local existente.
- Os arquivos WAV são armazenados em bucket PRIVADO reverse-audio. As regras de acesso estão no SQL.
- A revelação é controlada pelo anfitrião. Reabrir/atualizar a página não recupera automaticamente a sala; mantenha a aba aberta.
- Para usar celular, hospede em HTTPS; o microfone pode ser bloqueado em HTTP fora do localhost.
- Arquivos de áudio antigos permanecem no Storage ao reiniciar; para produção, implemente limpeza periódica de arquivos órfãos.
- Não foi feito teste integrado contra seu Supabase real: rode os testes de duas sessões após aplicar o SQL.
