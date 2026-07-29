# ZapFast - WhatsApp Automation Platform

A powerful WhatsApp automation platform built with React, Express, and Drizzle ORM.

## Features

- 🤖 WhatsApp automation using whatsapp-web.js
- 📊 Sales funnels and campaign management
- 💬 Automated messaging and responses
- 📈 Analytics and reporting
- 🎨 Modern React UI with Tailwind CSS

## Local Development

### Prerequisites

- Node.js 22+
- pnpm
- PostgreSQL (for database)

### Installation

1. Clone the repository:
```bash
git clone https://github.com/yuld52/gggggggggggggggggggggggggggggg.git
cd gggggggggggggggggggggggggggggg
```

2. Install dependencies:
```bash
pnpm install
```

3. Set up environment variables:
```bash
cp .env.example .env
# Edit .env with your database URL and other configuration
```

4. Run development server:
```bash
pnpm run dev
```

The application will be available at `http://localhost:5000`

## Deployment on Render

### Prerequisites

- Render account
- PostgreSQL database (Render Database or external)
- GitHub repository connected to Render

### Steps

1. Create a new Web Service on Render
2. Connect your GitHub repository
3. Add the following environment variables in Render Dashboard:

```
DATABASE_URL=your_postgresql_connection_string
NODE_ENV=production
```

4. Render will automatically detect and use `render.yaml` for build configuration

5. The service will be deployed at: `https://your-service-name.onrender.com`

### Required Environment Variables

- `DATABASE_URL` - PostgreSQL connection string
- `NODE_ENV` - Set to `production` for production deployments
- `PORT` - Automatically set by Render (default: 3000)

## Build & Production

### Build for production:
```bash
pnpm run build
```

### Start production server:
```bash
pnpm run start
```

## Project Structure

```
.
├── client/          # React frontend
├── server/          # Express backend
├── shared/          # Shared types and utilities
├── api/             # API routes
├── auth_info/       # WhatsApp authentication data
└── public/          # Static assets
```

## Database

Uses Drizzle ORM with PostgreSQL. Run migrations:

```bash
pnpm run db:push
```

## License

MIT
