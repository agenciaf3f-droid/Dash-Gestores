Criar um arquivo ZIP com todo o conteúdo do projeto (excluindo `node_modules`, `.git`, `dist` e caches) e disponibilizá-lo para download via `/mnt/documents`.

## Passos
1. Rodar `zip -r /mnt/documents/projeto-f3f-pulse-dash.zip . -x "node_modules/*" ".git/*" "dist/*" ".vite/*"` a partir da raiz do projeto.
2. Verificar tamanho e integridade do arquivo gerado.
3. Entregar via tag `<presentation-artifact>` para download imediato.

## Observação
O ZIP incluirá `public/dashboard.html` (com todas as alterações recentes de churn, NPS Abril e exclusão de Felps/Mylla), `src/`, `supabase/config.toml`, `package.json`, `index.html`, configs (Vite, Tailwind, TS) e `.env`. Sem dependências instaladas — basta `npm install` após extrair.