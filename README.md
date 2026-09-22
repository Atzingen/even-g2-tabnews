# even-g2-tabnews

App Even Hub para o Even G2: leitura da Newsletter do Filipe Deschamps publicada
pela conta `NewsletterOficial` no [TabNews](https://www.tabnews.com.br/), com
Relevantes e Recentes da comunidade como fontes alternativas.

Na primeira execução, abre direto na newsletter do último dia disponível.
O cabeçalho mostra a data real da publicação no fuso de São Paulo; não promete
uma edição completa do e-mail. No celular, escolha a fonte e o período
(último dia disponível ou últimos 5 dias). As preferências ficam salvas localmente.

A lista mostra até três títulos por página, cada um com até duas linhas e
espaço entre notícias. Títulos maiores são truncados na lista; o leitor abre
o título e conteúdo completos. Autor, votos e comentários aparecem no leitor.

Não há backend: o WebView chama a API pública do TabNews diretamente, inclusive
`/api/v1/contents/NewsletterOficial?strategy=new` para a seleção editorial.
A permissão `network` continua limitada a `https://www.tabnews.com.br`.

## Uso no óculos e no celular

| Tela | Gesto ou controle | Ação |
|---|---|---|
| Lista | swipe cima / baixo | move o cursor `>` e muda de página automaticamente |
| Lista | toque | abre o post selecionado |
| Lista | duplo toque | diálogo de saída do sistema |
| Leitor | toque | próxima página; na última, volta para a lista |
| Leitor | swipe cima / baixo | página anterior / próxima |
| Leitor | duplo toque | volta para a lista, mantendo a posição |
| Erro ou lista vazia | toque | tenta novamente |
| Celular | Fonte / Período | altera a seleção, volta à lista e salva a preferência |
| Celular | Atualizar notícias | busca novamente a fonte escolhida |

Atualiza a cada 30 minutos enquanto a lista está aberta, preservando a notícia
selecionada quando ainda está disponível. Um erro da newsletter não troca a
fonte automaticamente para a comunidade. As consultas têm limite de três
páginas de 100 itens; Relevantes mantém a ordem do TabNews dentro dessa amostra.

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
| `src/tabnews.ts` | API por fonte e período, datas em São Paulo, até três páginas de 100, Markdown e texto do leitor. |
| `src/listing.ts` | Títulos medidos com `@evenrealities/pretext`, três notícias em oito linhas, cursor e cabeçalho com fonte/data/posição. |
| `src/preferences.ts` | Preferências locais de fonte e período, com fallback quando o armazenamento está indisponível. |
| `src/style.css` | Interface do companion no celular. |
| `src/paginate.ts` | Paginação do texto do post, copiada do template oficial `text-heavy`. |
| `app.json` | Manifesto Even Hub (`com.atzingen.tabnews`, permissão `network`). |

Limites do G2 que moldaram o desenho: tela 576x288, uma fonte fixa com linha de 27 px, sem rolagem
(só troca de página), lista nativa limitada a 20 itens de 64 caracteres (por isso a lista é um
container de texto com cursor), 2000 caracteres por atualização de container.

## Notas locais (Omarchy / Hyprland)

### Screenshots para a loja

Para 0.2.0, usar os PNGs RGBA nativos em `store/screenshots-0.2.0/`. A pasta `store/screenshots-rgba/` preserva a versão 0.1.0. As primeiras imagens
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
