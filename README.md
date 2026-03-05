# Quanta AI

A free AI chat assistant powered by multiple models including Mistral, Qwen, DeepSeek, and more.

## Features

- **Multi-model AI Chat** – Switch between Mistral Small, Qwen 3.5, Qwen3 Coder, MiniMax M2.1, DeepSeek V3.2, and Sarvam M
- **Code Assistant** – Get help writing, reviewing, and debugging code
- **Deep Research** – AI-powered in-depth research on any topic
- **Language Translation** – Translate text across multiple languages
- **Voice Chat** – Interact with AI using your voice
- **Image Analysis** – Upload and analyze images with AI vision
- **Text Summarization** – Summarize long documents instantly
- **Task Scheduling** – Schedule and execute AI-powered tasks

## Tech Stack

- **Frontend:** React 18, TypeScript, Vite, Tailwind CSS, shadcn/ui
- **Backend:** Supabase (Edge Functions, Auth, Database)
- **PWA:** vite-plugin-pwa for offline support

## Getting Started

### Prerequisites

- Node.js 18+
- A Supabase project

### Installation

```bash
# Install dependencies
npm install

# Start the development server
npm run dev
```

### Environment Variables

Create a `.env` file in the root directory and add your Supabase credentials:

```env
VITE_SUPABASE_URL=your_supabase_url
VITE_SUPABASE_ANON_KEY=your_supabase_anon_key
```

### Build for Production

```bash
npm run build
```

## License

This project is private and all rights are reserved.
