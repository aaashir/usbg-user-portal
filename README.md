# US Business Grants Portal

This is a Next.js application for the US Business Grants user portal.

## Getting Started

1. Install dependencies:
   ```bash
   npm install
   ```

2. Set up environment variables:
   Copy `.env.local.example` to `.env.local` and fill in your Firebase configuration.
   ```bash
   cp .env.local.example .env.local
   ```

3. Run the development server:
   ```bash
   npm run dev
   ```

4. Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

## Project Structure

- `src/app`: App router pages and layout.
- `src/components/layout`: Layout components like Sidebar.
- `src/components/dashboard`: Dashboard widgets.
- `src/lib`: Utility functions and Firebase configuration.

## Features

- **Dashboard**: Overview of grant matches, deadlines, readiness checklist, AI assistant, and documents.
- **Grant Matches**: List of potential grant matches.
- **Upcoming Deadlines**: Tracking of grant application deadlines.
- **Readiness Checklist**: Checklist for grant readiness.
- **AI Assistant**: Tools to assist with grant writing.
- **Document Vault**: Storage for important business documents.
- **Progress Tracker**: Visual tracker for application progress.

## Tech Stack

- **Framework**: Next.js 15 (App Router)
- **Styling**: Tailwind CSS
- **Icons**: Lucide React
- **Backend/Auth**: Firebase (configured in `src/lib/firebase.ts`)
