# 🎬 Studio Recorder

Um aplicativo profissional de gravação de tela desenvolvido com Electron, React e TypeScript. Grave sua tela com qualidade profissional, inclua sua webcam em overlay transparente e utilize um teleprompter para suas apresentações e vídeos.

## ✨ Funcionalidades

### 🖥️ Gravação de Tela

- **Seleção de Fonte**: Escolha entre gravar a tela inteira, janelas específicas ou aplicativos individuais
- **Múltiplos Formatos**: Suporte para WebM (VP9/VP8) e MP4 (H.264)
- **Alta Qualidade**: Gravação em até 1080p com taxa de bits configurável
- **Ocultação Automática**: Janela de controle é automaticamente ocultada durante a gravação

### 📹 Overlay de Câmera

- **Janela Transparente**: Overlay flutuante que aparece sobre qualquer aplicativo
- **Formatos Personalizáveis**: Escolha entre formato circular, quadrado ou arredondado
- **Tamanhos Ajustáveis**: Pequeno (200x200), Médio (300x300) ou Grande (450x450)
- **Espelhamento Automático**: A imagem da câmera é espelhada para uma experiência natural
- **Sempre no Topo**: A janela permanece visível acima de outras aplicações

### 📝 Teleprompter

- **Texto em Tempo Real**: Digite seu script no painel de controle e veja aparecer instantaneamente no teleprompter
- **Animação Automática**: O texto rola automaticamente em uma animação suave
- **Protegido**: O teleprompter não aparece nas gravações (proteção contra captura)
- **Fácil de Fechar**: Clique no botão X ou pressione ESC para fechar

## 🚀 Tecnologias

- **Electron** - Framework para aplicativos desktop multiplataforma
- **React 19** - Biblioteca para construção de interfaces de usuário
- **TypeScript** - Superset do JavaScript com tipagem estática
- **Vite** - Build tool rápida e moderna
- **Tailwind CSS** - Framework CSS utilitário para design moderno
- **Lucide React** - Biblioteca de ícones moderna

## 📋 Pré-requisitos

Antes de começar, certifique-se de ter instalado:

- **Node.js** (versão 18 ou superior)
- **npm** ou **yarn**
- **Git** (para clonar o repositório)

## 🛠️ Instalação

1. Clone o repositório:

```bash
git clone https://github.com/seu-usuario/screen-recorder-electron.git
cd screen-recorder-electron
```

2. Instale as dependências:

```bash
npm install
```

## 💻 Desenvolvimento

Para iniciar o aplicativo em modo de desenvolvimento:

```bash
npm start
```

Este comando irá:

- Compilar o código TypeScript do Electron
- Iniciar o servidor de desenvolvimento do Vite
- Abrir a aplicação Electron

O aplicativo recarregará automaticamente quando você fizer alterações no código.

## 🏗️ Build

Para criar uma versão de produção:

```bash
npm run electron:build
```

Isso irá:

- Compilar o código TypeScript
- Fazer o build do frontend React
- Gerar os arquivos na pasta `dist` e `dist-electron`

Para criar um executável instalável, você precisará configurar o `electron-builder` no `package.json`.

## 📦 Scripts Disponíveis

- `npm start` - Inicia o aplicativo em modo de desenvolvimento
- `npm run dev` - Inicia apenas o servidor Vite (frontend)
- `npm run build` - Faz o build do frontend
- `npm run build:main` - Compila o código TypeScript do Electron
- `npm run electron:build` - Build completo (main + frontend)
- `npm run electron:start` - Inicia o Electron (após build)
- `npm run lint` - Executa o linter ESLint

## 🎯 Como Usar

### 1. Iniciar Gravação

1. Abra o aplicativo
2. Selecione a fonte de gravação (tela ou janela) no dropdown
3. Escolha o formato de vídeo desejado
4. Clique em "Iniciar Gravação"
5. A janela de controle será ocultada automaticamente

### 2. Configurar Câmera

1. No painel de configurações à direita, escolha o formato da câmera:
   - **Círculo**: Formato circular clássico
   - **Quadrado**: Formato retangular padrão
   - **Arredondado**: Cantos arredondados
2. Selecione o tamanho: Pequeno, Médio ou Grande
3. Use o botão de visibilidade para mostrar/ocultar a câmera

### 3. Usar o Teleprompter

1. Clique em "Abrir Janela" na seção Teleprompter
2. Digite seu script na área de texto
3. O texto aparecerá automaticamente no teleprompter
4. Para fechar, clique no X ou pressione ESC

### 4. Parar e Salvar

1. Clique em "Parar Gravação" (o botão fica vermelho durante a gravação)
2. Uma janela de diálogo aparecerá para salvar o arquivo
3. Escolha o local e o nome do arquivo
4. O vídeo será salvo no formato selecionado

## 🔧 Configurações Avançadas

### Formatos de Vídeo

- **WebM (VP9)**: Melhor qualidade e menor tamanho de arquivo
- **WebM (VP8)**: Boa compatibilidade com navegadores
- **MP4 (H.264)**: Formato universal, mais compatível com editores de vídeo

### Permissões Necessárias

No macOS, você precisará conceder as seguintes permissões:

- **Acesso à Tela**: Para gravar a tela
- **Acesso à Câmera**: Para usar a webcam no overlay

## 🏗️ Estrutura do Projeto

```
screen-recorder-electron/
├── electron/           # Código do processo principal do Electron
│   ├── main.ts        # Processo principal
│   ├── preload.ts     # Script de preload (bridge IPC)
│   └── tsconfig.json  # Configuração TypeScript
├── src/               # Código fonte do frontend
│   ├── views/         # Componentes das views
│   │   ├── ControlPanel.tsx    # Painel de controle principal
│   │   ├── CameraOverlay.tsx   # Overlay da câmera
│   │   └── Teleprompter.tsx    # Janela do teleprompter
│   ├── App.tsx        # Componente principal
│   └── main.tsx       # Ponto de entrada React
├── dist/              # Build do frontend
├── dist-electron/     # Build do Electron
└── public/            # Arquivos estáticos
```

## 🤝 Contribuindo

Contribuições são bem-vindas! Sinta-se à vontade para:

1. Fazer um fork do projeto
2. Criar uma branch para sua feature (`git checkout -b feature/AmazingFeature`)
3. Commit suas mudanças (`git commit -m 'Add some AmazingFeature'`)
4. Push para a branch (`git push origin feature/AmazingFeature`)
5. Abrir um Pull Request

## 📝 Licença

Este projeto está sob a licença MIT. Veja o arquivo `LICENSE` para mais detalhes.

## 🐛 Problemas Conhecidos

- No macOS, a janela de controle pode aparecer brevemente durante o início da gravação antes de ser ocultada
- Alguns formatos podem não estar disponíveis dependendo do sistema operacional

## 📮 Suporte

Se você encontrar algum problema ou tiver sugestões, por favor abra uma issue no GitHub.

## 🎨 Créditos

Desenvolvido com ❤️ usando Electron, React e TypeScript.

---

**Nota**: Este é um projeto em desenvolvimento ativo. Novas funcionalidades e melhorias são adicionadas regularmente.
