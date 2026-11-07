# REVERSE Online — primeira etapa

Esta versão adiciona o lobby online ao projeto React/Vite sem substituir o modo local.

## O que já foi preparado
- Botão **JOGAR ONLINE** na tela inicial.
- Autenticação anônima do Supabase para identificar cada navegador/celular.
- Criação de salas com código de 6 caracteres.
- Entrada por código.
- Lobby com lista de participantes em tempo real.
- Limite de 8 jogadores e mínimo de 2 para iniciar.
- Apenas o anfitrião consegue iniciar (validação feita no banco).
- Saída da sala; se o anfitrião sair, a sala é removida.
- SQL com RLS, funções RPC e publicação Realtime.

## Configuração
Siga `GUIA-SUPABASE.md` e execute `supabase/schema.sql` no SQL Editor.

Depois crie `.env` na raiz a partir de `.env.example`, preencha a URL e a chave pública anon/publishable e rode:

```bash
npm install
npm run dev
```

Não use a chave `service_role` no frontend.

## Próxima etapa
Conectar o estado `playing` ao fluxo real do REVERSE: ordem dos jogadores, turnos, envio de gravações para Supabase Storage, reprodução do áudio invertido, sincronização e recuperação de partidas após reconexão.
