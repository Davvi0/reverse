# React + Vite

This template provides a minimal setup to get React working in Vite with HMR and some Oxlint rules.

Currently, two official plugins are available:

- [@vitejs/plugin-react](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react) uses [Oxc](https://oxc.rs)
- [@vitejs/plugin-react-swc](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react-swc) uses [SWC](https://swc.rs/)

## React Compiler

The React Compiler is not enabled on this template because of its impact on dev & build performances. To add it, see [this documentation](https://react.dev/learn/react-compiler/installation).

## Expanding the Oxlint configuration

If you are developing a production application, we recommend using TypeScript with type-aware lint rules enabled. Check out the [TS template](https://github.com/vitejs/vite/tree/main/packages/create-vite/template-react-ts) for information on how to integrate TypeScript and Oxlint's TypeScript related rules in your project.

## Verificação do competitivo

Execute `npm ci`, `npm run build` e `npm test`. Os testes de navegador usam o Microsoft Edge instalado e iniciam o Vite na porta 5174 quando necessário.

A regressão verifica o conteúdo do Blob entregue ao player nas rodadas 1, 3, 5 e 7 e a referência original nas avaliações em dupla. As respostas do Supabase são simuladas; o teste não cria salas nem grava dados reais e não substitui uma partida com dois dispositivos. Também captura a tela inicial e a votação em larguras de 390 e 1280 pixels, em `test-results/`.
