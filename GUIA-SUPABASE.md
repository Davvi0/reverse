# Configurar o Supabase do REVERSE

## 1. Criar o projeto
1. Acesse https://supabase.com e crie um projeto.
2. Abra **Project Settings → API**.
3. Copie a **Project URL** e a chave pública **anon** (ou publishable key).
4. No painel, abra **Authentication → Sign In / Providers** e habilite **Anonymous Sign-Ins**.

## 2. Criar as tabelas e funções
1. Abra **SQL Editor → New query**.
2. Copie todo o conteúdo de `supabase/schema.sql`.
3. Execute o script.

## 3. Configurar o React
1. Na raiz do projeto, faça uma cópia de `.env.example` com o nome `.env`.
2. Preencha `VITE_SUPABASE_URL` e `VITE_SUPABASE_ANON_KEY` com os valores do seu projeto.
3. Instale as dependências: `npm install`.
4. Inicie: `npm run dev`.

Não coloque a `service_role` key no React nem no arquivo `.env` do frontend. O navegador deve usar somente a chave pública anon/publishable; a segurança fica nas políticas RLS e nas funções SQL.

## 4. Testar
- Abra o jogo em dois navegadores ou celulares diferentes.
- Em um, crie a sala e copie o código.
- No outro, entre com o código.
- Confira se os dois nomes aparecem no lobby.
- Tente iniciar pelo segundo jogador: o banco deve bloquear.
- Volte ao anfitrião e inicie: ambos devem ver a mudança de estado.

## Escopo desta primeira entrega
O modo online já cria salas, aceita participantes, mostra o lobby em tempo real e valida o anfitrião. A tela de partida online ainda é uma etapa seguinte: sincronizar turnos, gravações e reprodução de áudio. O modo local original permanece separado.
