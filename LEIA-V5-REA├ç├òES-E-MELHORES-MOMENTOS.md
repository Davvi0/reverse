# REVERSE V5 — Reações ao vivo + Melhores momentos

Esta versão é baseada em REVERSE-competitivo-v4-corrigido.zip e preserva o modo local, a votação, o placar e as opções de 3, 5 ou 8 rodadas.

## Instalar

1. Substitua os arquivos do seu projeto pelos deste ZIP, preservando seu arquivo `.env`.
2. Nenhum SQL novo é necessário: mantenha o SQL da Etapa 4 previamente executado.
3. Rode `npm install` e `npm run dev`.
4. Entre com dois navegadores diferentes, jogue uma partida completa e teste os emojis durante as tentativas, votação ou revelação.
5. Ao encerrar, abra a seção **Os melhores momentos** na tela final para escutar as tentativas mais votadas.

## Como funciona

- **Reações ao vivo:** são eventos efêmeros enviados pelo Supabase Realtime Broadcast à sala, sem gravar no banco; aparecem por aproximadamente 4 segundos; há um pequeno intervalo entre envios para evitar spam. Reações não mudam votos nem pontos.
- **Melhores momentos:** lista até cinco tentativas com mais votos (ou melhor avaliação em dupla), somando apenas as rodadas da partida atual. O jogador pode ouvir a tentativa normal ou invertida novamente. Os áudios já existem no Supabase Storage. Na revanche, a lista não mistura rodadas anteriores.
- Sem novos serviços externos, custos de análise de voz ou tabelas adicionais.

## Arquivos adicionados

- `src/components/LiveReactions.jsx`
- `src/components/BestMoments.jsx`

## Arquivos alterados

- `src/components/CompetitiveGame.jsx`
- `src/index.css`

## Observações

As reações exigem que a conexão com Supabase Realtime esteja ativa nos dois navegadores. Se constar "CONECTANDO...", verifique a conexão Realtime e as configurações de Broadcast do projeto Supabase. O modo local não exige sincronização de reações entre dispositivos.

O build de produção não foi concluído neste ambiente porque `npm ci` excedeu o tempo limite; valide com `npm run build` no seu computador.
