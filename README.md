# even-g2-tabnews

App Even Hub para o óculos Even G2 que mostra os posts do [TabNews](https://www.tabnews.com.br/)
dos últimos 5 dias, em dois modos (Relevantes e Recentes), com leitura do post inteiro no óculos.

Não há backend: o WebView do app Even chama a API pública do TabNews direto
(`/api/v1/contents`, CORS `*`). A permissão `network` no `app.json` só libera `https://www.tabnews.com.br`.

## Uso no óculos

| Tela | Gesto | Ação |
|---|---|---|
| Lista | swipe cima / baixo | move o cursor `>` (muda de página sozinho) |
| Lista | toque | abre o post selecionado; no item `Modo:` alterna Relevantes / Recentes |
| Lista | duplo toque | diálogo de saída do sistema |
| Leitor | toque | próxima página (na última volta para a lista) |
| Leitor | swipe cima / baixo | página anterior / próxima |
| Leitor | duplo toque | volta para a lista, mantendo a posição |
| Erro | toque | tenta de novo |

O cabeçalho da lista mostra modo, posição (`5/63`), autor, tabcoins e comentários do item selecionado.
A lista recarrega a cada 30 minutos enquanto está aberta.

## Desenvolvimento

```bash
npm install
npm test               # vitest: dados do TabNews, listagem com cursor, paginação
npm run dev            # vite em http://localhost:5173 (host binding para a LAN)
npm run simulate       # simulador GTK (GDK_BACKEND=x11 por causa do Hyprland)
npm run simulate:auto  # simulador com API HTTP em 127.0.0.1:9898 (screenshot, input, console)
npm run pack           # tsc + testes + build + out.ehpk (--sdk-ver 0.0.14)
```

No óculos de verdade: `npx evenhub qr --url http://<IP-da-LAN>:5173` e escanear no app Even
(Developer Mode ligado, celular no mesmo Wi-Fi). O sideload por QR só vive enquanto o `npm run dev`
estiver rodando. Para ficar instalado, subir o `out.ehpk` em hub.evenrealities.com e colocar o
próprio e-mail num grupo Beta.

## Estrutura

| Arquivo | Papel |
|---|---|
| `src/main.ts` | Ponte com o óculos: dois containers de texto (cabeçalho 35 px + corpo), roteamento de eventos, telas lista / leitor / erro. |
| `src/tabnews.ts` | API do TabNews (janela de 5 dias, até 3 páginas de 100), Markdown para texto plano, texto do leitor. |
| `src/listing.ts` | Entradas da lista (título em até 2 linhas medido com `@evenrealities/pretext`), paginação em 8 linhas, cursor, cabeçalho. |
| `src/paginate.ts` | Paginação do texto do post, copiada do template oficial `text-heavy`. |
| `app.json` | Manifesto Even Hub (`com.atzingen.tabnews`, permissão `network`). |

Limites do G2 que moldaram o desenho: tela 576x288, uma fonte fixa com linha de 27 px, sem rolagem
(só troca de página), lista nativa limitada a 20 itens de 64 caracteres (por isso a lista é um
container de texto com cursor), 2000 caracteres por atualização de container.

## Notas locais (Omarchy / Hyprland)

### Screenshots para a loja

Usar os PNGs RGBA nativos em `store/screenshots-rgba/`. As primeiras imagens
com fundo preto foram rejeitadas pelo Even Hub. O canal alpha permite que
o cenário escolhido no portal apareça atrás do texto.

Com `npm run simulate:auto` aberto na tela desejada, capturar diretamente:

```bash
curl --fail --max-time 10 http://127.0.0.1:9898/api/screenshot/glasses -o captura.png
identify -format '%wx%h %[channels] opaco=%[opaque]\n' captura.png
```

O resultado deve ser `576x288`, com alpha e `opaco=False`. Não converter para
RGB, achatar ou adicionar fundo. Consulte `store/listing.md` para os arquivos.

### Ambiente gráfico

- O simulador é GTK e cai no Wayland do Hyprland (`Error 71 dispatching to Wayland display`); os scripts
  usam `GDK_BACKEND=x11`. Com NVIDIA, em X11 as janelas ficam em branco (`Failed to create GBM buffer`)
  a menos que se exporte `WEBKIT_DISABLE_DMABUF_RENDERER=1`, já incluído nos scripts.
  Em um shell sem as variáveis de sessão, exportar `DISPLAY=:0 WAYLAND_DISPLAY=wayland-1`.
- A automação do simulador (`/api/screenshot/glasses`, `/api/input`, `/api/console`) é a forma
  de testar sem óculos; screenshots são PNG RGBA em que fundo tem alpha 0.
- O ufw do desktop tem política DROP na entrada. Para o celular alcançar o dev server foi criada a regra
  `sudo ufw allow from 10.137.0.0/24 to any port 5173 proto tcp comment 'Even Hub dev server (vite)'`
  (2026-09-09). Sem ela o app Even fica em "loading" após o scan.

## Publicação

- [Política de privacidade](PRIVACY.md)
- [Termos de uso](TERMS.md)
- [Descrição e materiais da loja](store/listing.md)
